import { prisma } from "../prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { emailHash, parisTime } from "../outreach/core";
import {
  ONOFF_NUMBER,
  hash,
  mobileNumber,
  defaultSms,
  textSchema,
  onoffPayload,
  isOpposition,
  SmsInputError,
} from "./core";

async function lock(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('flexweb-sms-channel'))`;
}
export async function settings() {
  return prisma.smsAutomationSettings.upsert({
    where: { id: "onoff" },
    update: {},
    create: { id: "onoff", sender: ONOFF_NUMBER },
  });
}
export async function createConnectionKeys() {
  const webhookKey = randomBytes(32).toString("hex"),
    dispatchKey = randomBytes(32).toString("hex");
  await prisma.$transaction(async (tx) => {
    await lock(tx);
    const current = await tx.smsAutomationSettings.findUnique({
      where: { id: "onoff" },
    });
    if (current?.webhookKeyHash || current?.dispatchKeyHash)
      throw new SmsInputError(
        "Les clés ont déjà été créées. Conservez les connexions existantes.",
      );
    await tx.smsAutomationSettings.upsert({
      where: { id: "onoff" },
      update: {
        webhookKeyHash: hash(webhookKey),
        dispatchKeyHash: hash(dispatchKey),
        enabled: false,
      },
      create: {
        id: "onoff",
        sender: ONOFF_NUMBER,
        webhookKeyHash: hash(webhookKey),
        dispatchKeyHash: hash(dispatchKey),
      },
    });
  });
  return { webhookKey, dispatchKey };
}
const url = z
  .string()
  .url()
  .max(2000)
  .refine((v) => new URL(v).protocol === "https:", "Utilisez un lien HTTPS.");
const contactInput = z.object({
  companyName: z.string().trim().min(2).max(150),
  city: z.string().trim().min(2).max(100),
  phone: z.string().max(60),
  sourceUrl: url,
  websiteCheckUrl: url,
});
export async function addContact(form: FormData) {
  const v = contactInput.parse(Object.fromEntries(form));
  const phone = mobileNumber(v.phone);
  await prisma.$transaction(async (tx) => {
    await lock(tx);
    if (
      await tx.smsSuppression.findUnique({ where: { phoneHash: hash(phone) } })
    )
      throw new SmsInputError("Ce numéro a demandé à ne plus être contacté.");
    if (await tx.smsOutreachContact.findUnique({ where: { phone } }))
      throw new SmsInputError(
        "Ce numéro est déjà présent. Ouvrez sa fiche existante.",
      );
    const candidates = await tx.outreachLead.findMany({
      where: { phone: { not: null } },
      take: 500,
    });
    const lead = candidates.find((l) => {
      try {
        return mobileNumber(l.phone!) === phone;
      } catch {
        return false;
      }
    });
    if (lead?.stoppedAt || lead?.firstSentAt)
      throw new SmsInputError(
        "Ce prospect possède déjà une prise de contact ou un arrêt dans la prospection par e-mail.",
      );
    await tx.smsOutreachContact.create({
      data: {
        ...v,
        phone,
        leadId: lead?.id,
        messages: { create: { body: defaultSms(v.companyName) } },
      },
    });
  });
}
export async function saveSms(id: string, form: FormData, userId: string) {
  const body = textSchema.parse(form.get("body"));
  const finding = z
    .enum(["TO_CHECK", "NOT_FOUND", "HAS_WEBSITE"])
    .parse(form.get("websiteFinding"));
  const basis = z
    .enum(["TO_CHECK", "CONSENT", "B2B"])
    .parse(form.get("contactBasis"));
  const evidence = z
    .string()
    .trim()
    .max(1500)
    .parse(form.get("evidence") || "");
  const approve = form.get("action") === "approve";
  if (
    approve &&
    (finding !== "NOT_FOUND" ||
      basis === "TO_CHECK" ||
      evidence.length < 20 ||
      form.get("verified") !== "on")
  )
    throw new SmsInputError(
      "Vérifiez le numéro professionnel, la recherche du site, le droit de contact et le message avant de le valider.",
    );
  await prisma.$transaction(async (tx) => {
    await lock(tx);
    const contact = await tx.smsOutreachContact.findUniqueOrThrow({
      where: { id },
      include: { messages: true },
    });
    if (
      contact.stoppedAt ||
      contact.messages.some((m) => m.attemptedAt || m.sentAt)
    )
      throw new SmsInputError(
        "Cette fiche a déjà un historique ou un arrêt ; aucun nouvel envoi automatique n’est autorisé.",
      );
    if (
      await tx.smsSuppression.findUnique({
        where: { phoneHash: hash(contact.phone) },
      })
    )
      throw new SmsInputError("Numéro sur la liste de non-contact.");
    const lead = contact.leadId
      ? await tx.outreachLead.findUnique({ where: { id: contact.leadId } })
      : null;
    if (lead && (lead.stoppedAt || lead.firstSentAt || lead.approvedAt))
      throw new SmsInputError(
        "Une séquence e-mail est déjà engagée pour ce prospect.",
      );
    await tx.smsOutreachContact.update({
      where: { id },
      data: {
        websiteFinding: finding,
        contactBasis: basis,
        evidence,
        checkedAt: approve ? new Date() : null,
        reviewedBy: approve ? userId : null,
      },
    });
    await tx.smsOutreachMessage.update({
      where: { contactId: id },
      data: {
        body,
        status: approve ? "APPROVED" : "DRAFT",
        approvedAt: approve ? new Date() : null,
        approvedBy: approve ? userId : null,
      },
    });
    await tx.smsOutreachEvent.create({
      data: {
        contactId: id,
        kind: approve ? "APPROVED" : "EDITED",
        detail: approve
          ? "Numéro, recherche du site, droit de contact et texte vérifiés."
          : "Brouillon enregistré ; validation retirée.",
      },
    });
  });
}
async function stopContact(
  tx: Prisma.TransactionClient,
  id: string,
  reason: string,
) {
  const c = await tx.smsOutreachContact.findUniqueOrThrow({ where: { id } });
  const opposition = reason === "STOP";
  await tx.smsOutreachContact.update({
    where: { id },
    data: {
      stoppedAt: c.stoppedAt || new Date(),
      stopReason: opposition ? "STOP" : c.stopReason || reason,
    },
  });
  await tx.smsOutreachMessage.updateMany({
    where: { contactId: id, status: { in: ["DRAFT", "APPROVED"] } },
    data: { status: "SKIPPED" },
  });
  if (opposition)
    await tx.smsSuppression.upsert({
      where: { phoneHash: hash(c.phone) },
      update: {},
      create: { phoneHash: hash(c.phone), reason: "SMS_STOP" },
    });
  if (c.leadId) {
    const lead = await tx.outreachLead.findUnique({ where: { id: c.leadId } });
    if (lead) {
      await tx.outreachLead.update({
        where: { id: lead.id },
        data: {
          stoppedAt: lead.stoppedAt || new Date(),
          stopReason: opposition ? "SMS_STOP" : lead.stopReason || "SMS_REPLY",
          stage: opposition
            ? "UNSUBSCRIBED"
            : lead.stoppedAt
              ? lead.stage
              : "REPLIED",
        },
      });
      await tx.outreachMessage.updateMany({
        where: { leadId: lead.id, status: { in: ["DRAFT", "APPROVED"] } },
        data: { status: "SKIPPED" },
      });
      if (opposition && lead.email)
        await tx.outreachSuppression.upsert({
          where: { emailHash: emailHash(lead.email) },
          update: {},
          create: { emailHash: emailHash(lead.email), reason: "SMS_STOP" },
        });
    }
  }
}
export async function stopSms(id: string, reason: "STOP" | "CLOSED") {
  await prisma.$transaction(async (tx) => {
    await lock(tx);
    await stopContact(tx, id, reason);
    await tx.smsOutreachEvent.create({
      data: {
        contactId: id,
        kind: reason,
        detail:
          reason === "STOP"
            ? "Opposition enregistrée par l’administration."
            : "Prise de contact arrêtée.",
      },
    });
  });
}
export async function setSmsEnabled(enabled: boolean) {
  await prisma.$transaction(async (tx) => {
    await lock(tx);
    const config = await tx.smsAutomationSettings.findUnique({
      where: { id: "onoff" },
    });
    if (!config) throw new SmsInputError("Raccordement à terminer.");
    if (enabled && (!config.webhookVerifiedAt || !config.dispatchVerifiedAt))
      throw new SmsInputError(
        "Testez la réception Onoff et la connexion Zapier avant activation.",
      );
    await tx.smsAutomationSettings.update({
      where: { id: "onoff" },
      data: { enabled },
    });
  });
}
// Zapier calls this immediately before its Send SMS action. Retrying a request
// never returns the same payload: an uncertain dispatch requires reconciliation.
export type SmsDispatch =
  | { send: false; reason: string }
  | { send: true; messageId: string; from: string; to: string; text: string };
export async function claimSms(
  requestId: string,
  now = new Date(),
): Promise<SmsDispatch> {
  return prisma.$transaction<SmsDispatch>(async (tx) => {
    await lock(tx);
    const cfg = await tx.smsAutomationSettings.findUniqueOrThrow({
      where: { id: "onoff" },
    });
    await tx.smsOutreachMessage.updateMany({
      where: {
        status: "DISPATCHED",
        attemptedAt: { lt: new Date(now.getTime() - 15 * 60000) },
      },
      data: { status: "REVIEW" },
    });
    if (
      !cfg.enabled ||
      !cfg.webhookVerifiedAt ||
      !cfg.dispatchVerifiedAt ||
      !parisTime(now).allowed
    )
      return { send: false, reason: "paused_or_outside_hours" };
    const requestHash = hash(requestId);
    if (
      await tx.smsOutreachMessage.findUnique({
        where: { dispatchRequestHash: requestHash },
      })
    )
      return { send: false, reason: "request_already_claimed" };
    const attempts = await tx.smsOutreachMessage.findMany({
      where: { attemptedAt: { gte: new Date(now.getTime() - 26 * 3600000) } },
      select: { attemptedAt: true },
    });
    if (
      attempts.filter(
        (m) => parisTime(m.attemptedAt!).day === parisTime(now).day,
      ).length >= Math.min(5, cfg.dailyLimit)
    )
      return { send: false, reason: "daily_limit" };
    // A missing confirmation stops the channel instead of allowing duplicate retries.
    if (
      await tx.smsOutreachMessage.count({
        where: { status: { in: ["DISPATCHED", "REVIEW"] } },
      })
    )
      return { send: false, reason: "previous_send_unconfirmed" };
    const pending = await tx.smsOutreachMessage.findMany({
      where: {
        status: "APPROVED",
        attemptedAt: null,
        approvedAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        contact: {
          stoppedAt: null,
          websiteFinding: "NOT_FOUND",
          contactBasis: { in: ["CONSENT", "B2B"] },
          checkedAt: { gte: new Date(now.getTime() - 30 * 86400000) },
        },
      },
      include: { contact: true },
      orderBy: { approvedAt: "asc" },
      take: 50,
    });
    for (const m of pending) {
      if (
        await tx.smsSuppression.findUnique({
          where: { phoneHash: hash(m.contact.phone) },
        })
      )
        continue;
      const lead = m.contact.leadId
        ? await tx.outreachLead.findUnique({ where: { id: m.contact.leadId } })
        : null;
      if (lead && (lead.stoppedAt || lead.firstSentAt || lead.approvedAt))
        continue;
      await tx.smsOutreachMessage.update({
        where: { id: m.id },
        data: {
          status: "DISPATCHED",
          attemptedAt: now,
          dispatchRequestHash: requestHash,
        },
      });
      return {
        send: true,
        messageId: m.id,
        from: cfg.sender,
        to: m.contact.phone,
        text: m.body,
      };
    }
    return { send: false, reason: "no_approved_message" };
  });
}
export async function recordOnoff(payload: unknown) {
  const event = onoffPayload.parse(payload);
  const date = new Date(event.date);
  return prisma.$transaction(async (tx) => {
    await lock(tx);
    const cfg = await tx.smsAutomationSettings.findUniqueOrThrow({
      where: { id: "onoff" },
    });
    // The documented setup payload uses dummy numbers. A valid authenticated
    // schema verifies transport, but never creates/imports contacts.
    await tx.smsAutomationSettings.update({
      where: { id: "onoff" },
      data: {
        webhookVerifiedAt: cfg.webhookVerifiedAt || new Date(),
        lastWebhookAt: new Date(),
      },
    });
    let sender: string, phone: string;
    try {
      sender = mobileNumber(event.onoffUserNumber);
      phone = mobileNumber(event.externalNumber);
    } catch {
      return { ignored: true };
    }
    if (sender !== cfg.sender) return { ignored: true };
    const contact = await tx.smsOutreachContact.findUnique({
      where: { phone },
    });
    if (
      !contact ||
      date < contact.createdAt ||
      date > new Date(Date.now() + 5 * 60000)
    )
      return { ignored: true };
    const externalId = `onoff:${event.id}`;
    if (await tx.smsOutreachEvent.findUnique({ where: { externalId } }))
      return { duplicate: true };
    if (event.smsDirection === "RECEIVED") {
      const reason = isOpposition(event.body) ? "STOP" : "REPLIED";
      await stopContact(tx, contact.id, reason);
      await tx.smsOutreachEvent.create({
        data: {
          contactId: contact.id,
          externalId,
          kind: reason,
          detail: event.body.slice(0, 2000),
          occurredAt: date,
        },
      });
    } else {
      const m = await tx.smsOutreachMessage.findUnique({
        where: { contactId: contact.id },
      });
      // Match the exact approved content, recipient and dispatch interval.
      if (
        !m?.attemptedAt ||
        !["DISPATCHED", "REVIEW"].includes(m.status) ||
        m.body !== event.body ||
        date.getTime() < m.attemptedAt.getTime() - 120000
      )
        return { ignored: true };
      await tx.smsOutreachMessage.update({
        where: { id: m.id },
        data: { status: "SENT", sentAt: date, providerEventId: event.id },
      });
      await tx.smsOutreachEvent.create({
        data: {
          contactId: contact.id,
          externalId,
          kind: "SENT",
          detail:
            "Envoi confirmé par Onoff. Cette confirmation ne prouve pas la lecture du SMS.",
          occurredAt: date,
        },
      });
    }
    return { received: true };
  });
}

export async function reconcileSms(id: string, form: FormData) {
  const outcome = z.enum(["sent", "failed"]).parse(form.get("outcome"));
  const evidence = z
    .string()
    .trim()
    .min(20)
    .max(1000)
    .parse(form.get("evidence"));
  if (form.get("verified") !== "on")
    throw new SmsInputError("Vérifiez d’abord le journal Onoff.");
  await prisma.$transaction(async (tx) => {
    await lock(tx);
    const m = await tx.smsOutreachMessage.findUniqueOrThrow({
      where: { contactId: id },
    });
    if (
      !m.attemptedAt ||
      !["DISPATCHED", "REVIEW"].includes(m.status) ||
      Date.now() - m.attemptedAt.getTime() < 15 * 60000
    )
      throw new SmsInputError(
        "Attendez 15 minutes puis vérifiez cet envoi dans Onoff.",
      );
    await tx.smsOutreachMessage.update({
      where: { id: m.id },
      data: {
        status: outcome === "sent" ? "SENT" : "SKIPPED",
        sentAt: outcome === "sent" ? m.attemptedAt : null,
      },
    });
    await tx.smsOutreachEvent.create({
      data: {
        contactId: id,
        kind: "MANUAL_RECONCILIATION",
        detail: `${outcome === "sent" ? "Envoi" : "Échec"} vérifié manuellement dans Onoff : ${evidence}. Aucun renvoi de ce SMS.`,
      },
    });
  });
}
