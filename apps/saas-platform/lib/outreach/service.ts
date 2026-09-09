import { prisma } from "../prisma";
import { emailSchema, emailHash, type Audit } from "./core";
import { webUrl } from "./web-audit";
import { prepareDrafts } from "./discovery";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export async function stopLead(
  id: string,
  reason: string,
  externalId?: string,
) {
  if (
    !["REPLIED", "REFUSED", "BOUNCED", "UNSUBSCRIBED", "CLOSED"].includes(
      reason,
    )
  )
    throw new Error("Motif invalide.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OutreachLead" WHERE id=${id} FOR UPDATE`;
    const lead = await tx.outreachLead.findUnique({ where: { id } });
    if (!lead) return;
    if (lead.stage === reason && reason !== "REPLIED") return;
    if (
      externalId &&
      (await tx.outreachEvent.findUnique({ where: { externalId } }))
    )
      return;
    if (lead.email && ["REFUSED", "BOUNCED", "UNSUBSCRIBED"].includes(reason))
      await tx.outreachSuppression.upsert({
        where: { emailHash: emailHash(lead.email) },
        update: {},
        create: { emailHash: emailHash(lead.email), reason },
      });
    // A later reply must never erase an existing opposition or a sales outcome.
    const preserve = [
      "REFUSED",
      "BOUNCED",
      "UNSUBSCRIBED",
      "INTERESTED",
      "MEETING",
      "WON",
    ].includes(lead.stage);
    await tx.outreachLead.update({
      where: { id },
      data: {
        stage: preserve ? lead.stage : reason,
        stoppedAt: lead.stoppedAt || new Date(),
        stopReason: lead.stopReason || reason,
      },
    });
    await tx.outreachMessage.updateMany({
      where: { leadId: id, status: { in: ["DRAFT", "APPROVED"] } },
      data: { status: "SKIPPED" },
    });
    await tx.outreachEvent.create({
      data: {
        leadId: id,
        type: reason,
        externalId,
        detail:
          reason === "REPLIED"
            ? "Réponse détectée : lire la boîte IONOS avant de poursuivre."
            : "Séquence arrêtée.",
      },
    });
  });
}
const contactSchema = z.object({
  email: emailSchema,
  website: z.string().max(2000),
  source: z.string().url().max(2000),
});
export async function saveLead(id: string, form: FormData, userId: string) {
  const contact = contactSchema.parse({
    email: form.get("email"),
    website: form.get("website") || "",
    source: form.get("source"),
  });
  const source = webUrl(contact.source).href;
  const website = contact.website ? webUrl(contact.website).href : null;
  const drafts = [0, 1, 2].map((step) => ({
    step,
    subject: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .regex(/^[^\r\n]+$/)
      .parse(form.get(`subject${step}`)),
    text: z
      .string()
      .trim()
      .min(25)
      .max(5000)
      .parse(form.get(`text${step}`)),
  }));
  const approve = form.get("action") === "approve";
  if (
    approve &&
    (form.get("relevance") !== "on" || form.get("diagnostic") !== "on")
  )
    throw new Error(
      "Vérifiez le destinataire professionnel, la pertinence et les trois messages.",
    );
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OutreachLead" WHERE id=${id} FOR UPDATE`;
    const lead = await tx.outreachLead.findUniqueOrThrow({
      where: { id },
      include: { messages: true },
    });
    if (
      lead.firstSentAt ||
      lead.stoppedAt ||
      lead.messages.some((m) => m.attemptedAt)
    )
      throw new Error("Cette prise de contact possède déjà un historique.");
    if (approve && Date.now() - lead.sourceFetchedAt.getTime() > 30 * 86400000)
      throw new Error(
        "La fiche de l’annuaire a plus de 30 jours. Actualisez-la avant validation.",
      );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"outreach-email:" + contact.email}))`;
    if (
      approve &&
      (await tx.outreachSuppression.findUnique({
        where: { emailHash: emailHash(contact.email) },
      }))
    )
      throw new Error("Cette adresse figure sur la liste de non-contact.");
    if (
      approve &&
      (await tx.outreachLead.count({
        where: {
          id: { not: id },
          email: contact.email,
          OR: [{ approvedAt: { not: null } }, { firstSentAt: { not: null } }],
        },
      }))
    )
      throw new Error(
        "Cette adresse est déjà utilisée dans une autre séquence.",
      );
    if (approve && lead.auditState === "PENDING")
      throw new Error(
        "Attendez le diagnostic ou sa demande de vérification manuelle avant de valider la séquence.",
      );
    if (approve && lead.website !== website)
      throw new Error(
        "Enregistrez le nouveau site, puis vérifiez son diagnostic avant validation.",
      );
    await tx.outreachLead.update({
      where: { id },
      data: {
        email: contact.email,
        website,
        contactSourceUrl: source,
        enrichmentState: "VERIFIED",
        stage: approve ? "APPROVED" : "NEW",
        approvedAt: approve ? new Date() : null,
        approvedBy: approve ? userId : null,
        ...(website !== lead.website
          ? {
              auditState: website ? "PENDING" : "MANUAL",
              audit: {
                checkedAt: new Date().toISOString(),
                pages: [],
                findings: [],
                note: "Site modifié : nouveau diagnostic en attente.",
              },
              score: 0,
            }
          : {}),
      },
    });
    for (const m of drafts)
      await tx.outreachMessage.update({
        where: { leadId_step: { leadId: id, step: m.step } },
        data: {
          subject: m.subject,
          text: m.text,
          status: approve ? "APPROVED" : "DRAFT",
        },
      });
    await tx.outreachEvent.create({
      data: {
        leadId: id,
        type: approve ? "APPROVED" : "EDITED",
        detail: approve
          ? "Destinataire, source, pertinence B2B et trois messages validés par l’administration."
          : "Brouillons modifiés ; validation retirée.",
      },
    });
  });
}
export async function regenerateDrafts(id: string) {
  const lead = await prisma.outreachLead.findUniqueOrThrow({ where: { id } });
  await prepareDrafts(id, lead.audit as Audit | null);
}
async function ensureProspect(tx: Prisma.TransactionClient, id: string) {
  const lead = await tx.outreachLead.findUniqueOrThrow({ where: { id } });
  if (
    lead.prospectId &&
    (await tx.prospect.findUnique({ where: { id: lead.prospectId } }))
  )
    return lead.prospectId;
  if (!lead.email)
    throw new Error("Renseignez l’adresse professionnelle avant le transfert.");
  const existing = await tx.prospect.findFirst({
    where: {
      companyName: lead.companyName,
      OR: [
        { email: lead.email },
        ...(lead.phone ? [{ phone: lead.phone }] : []),
      ],
    },
  });
  const p =
    existing ||
    (await tx.prospect.create({
      data: {
        companyName: lead.companyName,
        phone: lead.phone || "",
        email: lead.email,
        website: lead.website,
        city: lead.city,
        department: lead.postalCode.slice(0, 2),
        businessType: "Plomberie et chauffage",
        source: "prospection-locale",
        status: "INTERESSE",
      },
    }));
  await tx.outreachLead.update({ where: { id }, data: { prospectId: p.id } });
  return p.id;
}
export async function classifyLead(
  id: string,
  outcome: string,
  date: string,
  userId: string,
) {
  if (["REFUSED", "CLOSED"].includes(outcome)) return stopLead(id, outcome);
  if (!["INTERESTED", "MEETING", "WON"].includes(outcome))
    throw new Error("Étape invalide.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OutreachLead" WHERE id=${id} FOR UPDATE`;
    const lead = await tx.outreachLead.findUniqueOrThrow({ where: { id } });
    if (["REFUSED", "UNSUBSCRIBED", "BOUNCED"].includes(lead.stage))
      throw new Error("Cette fiche est sur la liste de non-contact.");
    const prospectId = await ensureProspect(tx, id);
    let appointmentId = lead.appointmentId;
    if (outcome === "MEETING") {
      const when = new Date(date);
      if (
        !date ||
        !Number.isFinite(when.getTime()) ||
        when.getTime() < Date.now()
      )
        throw new Error(
          "Indiquez un rendez-vous futur avec son fuseau horaire.",
        );
      const membership = await tx.membership.findFirstOrThrow({
        where: { userId, role: "SUPER_ADMIN" },
      });
      const data = {
        organizationId: membership.organizationId,
        prospectId,
        name: lead.companyName,
        email: lead.email!,
        phone: lead.phone,
        date: when,
        notes:
          "Rendez-vous confirmé manuellement depuis la prospection locale.",
      };
      const appointment = appointmentId
        ? await tx.appointment.update({ where: { id: appointmentId }, data })
        : await tx.appointment.create({ data });
      appointmentId = appointment.id;
    }
    await tx.outreachLead.update({
      where: { id },
      data: {
        stage: outcome,
        stoppedAt: lead.stoppedAt || new Date(),
        stopReason: lead.stopReason || "HANDOFF",
        appointmentId,
      },
    });
    await tx.outreachMessage.updateMany({
      where: { leadId: id, status: { in: ["DRAFT", "APPROVED"] } },
      data: { status: "SKIPPED" },
    });
    await tx.prospect.update({
      where: { id: prospectId },
      data: {
        status:
          outcome === "MEETING"
            ? "RDV_PLANIFIE"
            : outcome === "WON"
              ? "CLIENT_SIGNE"
              : "INTERESSE",
      },
    });
    if (
      outcome === "INTERESTED" &&
      !(await tx.followUp.count({ where: { prospectId, status: "PENDING" } }))
    )
      await tx.followUp.create({
        data: {
          prospectId,
          dueAt: new Date(Date.now() + 86400000),
          note: "Répondre personnellement au prospect intéressé.",
          createdById: userId,
        },
      });
    await tx.outreachEvent.create({
      data: {
        leadId: id,
        type: outcome,
        detail:
          "Qualification manuelle enregistrée ; relances automatiques arrêtées.",
      },
    });
  });
}
