import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { pilot, importRegistryPage, enrichNext, auditNext } from "./discovery";
import { dueStep, emailHash, parisTime, signedText, SENDER } from "./core";
import { mailboxConfigured, smtpTransport, syncMailbox } from "./mail";
import { stopLead } from "./service";

export async function withOutreachLease<T>(
  work: () => Promise<T>,
): Promise<T | null> {
  await prisma.outreachMailbox.upsert({
    where: { id: "ionos" },
    update: {},
    create: { id: "ionos" },
  });
  const token = randomUUID();
  const claimed = await prisma.outreachMailbox.updateMany({
    where: { id: "ionos", lockedUntil: { lt: new Date() } },
    data: { lockToken: token, lockedUntil: new Date(Date.now() + 90000) },
  });
  if (!claimed.count) return null;
  try {
    return await work();
  } finally {
    await prisma.outreachMailbox.updateMany({
      where: { id: "ionos", lockToken: token },
      data: { lockToken: null, lockedUntil: new Date(0) },
    });
  }
}
export type Deliver = (input: {
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}) => Promise<boolean>;
const deliver: Deliver = async (input) => {
  const transport = smtpTransport();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        transport.close();
        reject(new Error("SMTP deadline"));
      }, 9000);
    });
    const result = await Promise.race([
      timeout,
      transport.sendMail({
        from: { name: "FLEX-WEB", address: SENDER },
        replyTo: SENDER,
        ...input,
      }),
    ]);
    return result.accepted.some(
      (x) => String(x).toLowerCase() === input.to.toLowerCase(),
    );
  } finally {
    clearTimeout(timer);
    transport.close();
  }
};
// Called only under the shared lease, after a complete inbox sync. The callable
// transport lets isolated tests exercise uncertain SMTP results without sending.
export async function sendNext(now = new Date(), send: Deliver = deliver) {
  if (
    process.env.OUTREACH_SEND_ENABLED !== "true" ||
    !mailboxConfigured() ||
    !parisTime(now).allowed
  )
    return "Envois désactivés ou hors horaires.";
  const mailbox = await prisma.outreachMailbox.findUniqueOrThrow({
    where: { id: "ionos" },
  });
  if (
    mailbox.needsReview ||
    !mailbox.verifiedAt ||
    !mailbox.syncedAt ||
    now.getTime() - mailbox.syncedAt.getTime() > 60000 ||
    mailbox.lastError
  )
    return "Réception IONOS à vérifier.";
  const attempts = await prisma.outreachMessage.findMany({
    where: { attemptedAt: { gte: new Date(now.getTime() - 86400000) } },
    select: { attemptedAt: true },
  });
  const used = attempts.filter(
    (x) => parisTime(x.attemptedAt!).day === parisTime(now).day,
  ).length;
  const candidates = await prisma.outreachMessage.findMany({
    where: {
      status: "APPROVED",
      lead: {
        campaign: { enabled: true },
        approvedAt: { not: null },
        stoppedAt: null,
        stage: { in: ["APPROVED", "CONTACTED"] },
      },
    },
    include: {
      lead: {
        include: { campaign: true, messages: { orderBy: { step: "asc" } } },
      },
    },
    orderBy: [{ step: "asc" }, { id: "asc" }],
    take: 150,
  });
  for (const message of candidates) {
    const lead = message.lead;
    if (used >= Math.min(10, lead.campaign.dailyLimit))
      return "Plafond quotidien atteint.";
    if (
      !lead.email ||
      !dueStep(message.step, lead.firstSentAt, lead.lastSentAt, now)
    )
      continue;
    if (lead.messages.some((m) => m.step < message.step && m.status !== "SENT"))
      continue;
    if (
      !lead.firstSentAt &&
      (now.getTime() - lead.sourceFetchedAt.getTime() > 30 * 86400000 ||
        now.getTime() - lead.approvedAt!.getTime() > 30 * 86400000)
    )
      continue;
    if (
      await prisma.outreachSuppression.findUnique({
        where: { emailHash: emailHash(lead.email) },
      })
    ) {
      await stopLead(lead.id, "UNSUBSCRIBED");
      continue;
    }
    if (lead.prospectId) {
      const prospect = await prisma.prospect.findUnique({
        where: { id: lead.prospectId },
        select: { status: true },
      });
      if (
        prospect &&
        !["NOUVEAU", "A_CONTACTER", "SANS_REPONSE"].includes(prospect.status)
      ) {
        await stopLead(
          lead.id,
          prospect.status === "PAS_INTERESSE" ? "REFUSED" : "REPLIED",
        );
        continue;
      }
    }
    const claimed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OutreachLead" WHERE id=${lead.id} FOR UPDATE`;
      const fresh = await tx.outreachLead.findUniqueOrThrow({
        where: { id: lead.id },
        include: { campaign: true },
      });
      if (
        fresh.updatedAt.getTime() !== lead.updatedAt.getTime() ||
        fresh.email !== lead.email ||
        fresh.stoppedAt ||
        !fresh.approvedAt ||
        !fresh.campaign.enabled ||
        (await tx.outreachSuppression.findUnique({
          where: { emailHash: emailHash(lead.email!) },
        }))
      )
        return false;
      return (
        (
          await tx.outreachMessage.updateMany({
            where: { id: message.id, status: "APPROVED", attemptedAt: null },
            data: { status: "SENDING", attemptedAt: now },
          })
        ).count === 1
      );
    });
    if (!claimed) continue;
    try {
      const first = lead.messages.find((m) => m.step === 0);
      const accepted = await send({
        to: lead.email,
        subject: message.subject,
        text: signedText(lead, message.text),
        messageId: message.messageId,
        ...(message.step > 0
          ? { inReplyTo: first!.messageId, references: [first!.messageId] }
          : {}),
      });
      if (!accepted) throw new Error("Non accepté");
      await prisma.$transaction(async (tx) => {
        await tx.outreachMessage.update({
          where: { id: message.id },
          data: { status: "SENT", sentAt: now },
        });
        // Do not resurrect a lead stopped while SMTP was in flight.
        await tx.outreachLead.updateMany({
          where: { id: lead.id, stoppedAt: null },
          data: { stage: message.step === 2 ? "COMPLETE" : "CONTACTED" },
        });
        await tx.outreachLead.update({
          where: { id: lead.id },
          data: { firstSentAt: lead.firstSentAt || now, lastSentAt: now },
        });
        await tx.outreachEvent.create({
          data: {
            leadId: lead.id,
            type: "SENT",
            detail: `Message ${message.step + 1} accepté par le serveur SMTP ; livraison non garantie.`,
          },
        });
      });
      return "Un message accepté par IONOS.";
    } catch {
      await prisma.outreachMessage.update({
        where: { id: message.id },
        data: {
          status: "REVIEW",
          lastError:
            "Résultat SMTP incertain : vérifier la boîte avant toute reprise. Aucun nouvel essai automatique.",
        },
      });
      await prisma.outreachLead.updateMany({
        where: { id: lead.id, stoppedAt: null },
        data: { stoppedAt: new Date(), stopReason: "SMTP_REVIEW" },
      });
      return "Envoi à vérifier manuellement.";
    }
  }
  return "Aucun message validé à envoyer maintenant.";
}
export async function runOutreach() {
  const result = await withOutreachLease(async () => {
    const started = Date.now();
    const campaign = await pilot();
    await prisma.outreachMessage.updateMany({
      where: {
        status: "SENDING",
        attemptedAt: { lt: new Date(Date.now() - 90000) },
      },
      data: {
        status: "REVIEW",
        lastError:
          "Traitement interrompu : résultat SMTP à vérifier. Aucune répétition automatique.",
      },
    });
    let detail: string;
    const hasAttempt = await prisma.outreachMessage.count({
      where: { attemptedAt: { not: null } },
    });
    if (mailboxConfigured() && (campaign.enabled || hasAttempt)) {
      const synced = await syncMailbox();
      detail = synced
        ? Date.now() - started < 12000
          ? await sendNext()
          : "Réception synchronisée ; envoi reporté pour respecter le délai de traitement."
        : "Synchronisation de réception incomplète ; aucun envoi.";
    } else if (await importRegistryPage())
      detail = "Lot importé depuis l’annuaire officiel.";
    else if (await enrichNext())
      detail = "Coordonnées recherchées dans l’annuaire RGE.";
    else if (await auditNext())
      detail = "Diagnostic et trois brouillons préparés.";
    else detail = "Liste pilote préparée. Vérifiez les fiches et les messages.";
    await prisma.outreachCampaign.update({
      where: { id: campaign.id },
      data: { lastRunAt: new Date(), lastResult: detail },
    });
    return { detail };
  });
  return result || { detail: "Un traitement est déjà en cours." };
}
