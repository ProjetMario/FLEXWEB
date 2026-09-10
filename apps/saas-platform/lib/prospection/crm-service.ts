import { randomUUID } from "node:crypto";
import { Prisma, type ProspectionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { emailHash, newMessageId } from "../outreach/core";
import { defaultSms, hash, mobileNumber, textSchema } from "../sms/core";
import {
  crmEmailDrafts,
  importIdentity,
  importRow,
  normalizePhone,
  renderCrmTemplate,
} from "./crm-core";

export const crmLock = (tx: Prisma.TransactionClient) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('flexweb-sms-channel'))`;
const openStatuses: ProspectionStatus[] = [
  "NOUVEAU",
  "A_CONTACTER",
  "SMS_ENVOYE",
  "SANS_REPONSE",
  "A_RELANCER",
];

export async function importProspects(input: unknown[], batch: string) {
  if (!input.length || input.length > 100)
    throw Error("Importez de 1 à 100 lignes par lot.");
  if (!/^[\w-]{1,100}$/.test(batch))
    throw Error("Identifiant d’import invalide.");
  const rows = input.map((r, i) => {
    const parsed = importRow.safeParse(r);
    if (!parsed.success)
      throw Error(`Ligne ${i + 1} : ${parsed.error.issues[0].message}`);
    return parsed.data;
  });
  return prisma.$transaction(
    async (tx) => {
      await crmLock(tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('flexweb-crm-import'))`;
      const existing = await tx.prospect.findMany({
        where: {
          OR: [
            { importKey: { in: rows.map(importIdentity) } },
            { siren: { in: rows.map((r) => r.siren).filter(Boolean) } },
            { phone: { in: rows.map((r) => r.telephone).filter(Boolean) } },
            { email: { in: rows.map((r) => r.email).filter(Boolean) } },
          ],
        },
      });
      const created: Prisma.ProspectCreateManyInput[] = [];
      let duplicates = 0;
      const conflicts: string[] = [];
      for (const r of rows) {
        const key = importIdentity(r);
        const matches = [...existing, ...created].filter(
          (p) =>
            p.importKey === key ||
            (r.siren && p.siren === r.siren) ||
            (r.telephone && p.phone === r.telephone) ||
            (r.email && p.email?.toLowerCase() === r.email),
        );
        if (matches.length) {
          if (
            matches.length > 1 ||
            matches.some((p) => p.siren && r.siren && p.siren !== r.siren)
          )
            conflicts.push(r.entreprise);
          else duplicates++;
          continue;
        }
        created.push({
          id: randomUUID(),
          companyName: r.entreprise,
          phone: r.telephone,
          email: r.email || null,
          siren: r.siren || null,
          siret: r.siret || null,
          importKey: key,
          importBatch: batch,
          businessType: r.activite || null,
          department: r.departement || null,
          city: r.commune || null,
          source: r.source || "Import CSV",
          sourceUrl: r.url_source,
          sourceCheckedAt: r.date_collecte ? new Date(r.date_collecte) : null,
          registryState: r.etat_registre || null,
          internalNotes: r.notes || null,
          status: "NOUVEAU",
          websiteFinding: "TO_CHECK",
          preferredChannel: "NONE",
        });
      }
      const result = await tx.prospect.createMany({
        data: created,
        skipDuplicates: true,
      });
      return {
        created: result.count,
        duplicates: duplicates + created.length - result.count,
        conflicts,
      };
    },
    { timeout: 20000 },
  );
}

export async function ensureCrmProspect(
  tx: Prisma.TransactionClient,
  input: {
    companyName: string;
    phone?: string | null;
    email?: string | null;
    siren?: string | null;
    city?: string | null;
    website?: string | null;
    sourceUrl?: string | null;
  },
) {
  let phone = "";
  try {
    phone = normalizePhone(input.phone || "");
  } catch {
    /* Preserve the source until corrected. */
  }
  const email = input.email?.toLowerCase() || null;
  const siren = input.siren && /^\d{9}$/.test(input.siren) ? input.siren : null;
  const matches = await tx.prospect.findMany({
    where: {
      OR: [
        ...(siren ? [{ siren }] : []),
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
        { companyName: input.companyName, city: input.city || null },
      ],
    },
    take: 3,
  });
  if (
    matches.length > 1 ||
    matches.some((p) => siren && p.siren && siren !== p.siren)
  )
    throw Error(
      "Plusieurs fiches partagent ces coordonnées. Vérifiez les doublons dans le CRM.",
    );
  if (matches[0]) return matches[0];
  return tx.prospect.create({
    data: {
      companyName: input.companyName,
      phone,
      email,
      siren,
      city: input.city,
      website: input.website,
      sourceUrl: input.sourceUrl,
      source: "Prospection SMS / e-mail",
    },
  });
}

export async function crmBlocksChannel(
  tx: Prisma.TransactionClient,
  prospectId: string | null | undefined,
  channel: "SMS" | "EMAIL",
) {
  if (!prospectId) return false;
  const p = await tx.prospect.findUnique({ where: { id: prospectId } });
  if (
    !p ||
    p.doNotContactAt ||
    ["CLOSED", "HAS_WEBSITE"].includes(p.websiteFinding) ||
    !openStatuses.includes(p.status)
  )
    return true;
  return p.preferredChannel !== "NONE" && p.preferredChannel !== channel;
}

export async function stopCrmSequences(
  tx: Prisma.TransactionClient,
  prospectId: string,
  reason: string,
  opposition = false,
) {
  const p = await tx.prospect.findUniqueOrThrow({
    where: { id: prospectId },
    include: { emailLeads: true, smsContact: true },
  });
  const at = new Date();
  await tx.outreachMessage.updateMany({
    where: { lead: { prospectId }, status: { in: ["DRAFT", "APPROVED"] } },
    data: { status: "SKIPPED" },
  });
  await tx.outreachLead.updateMany({
    where: { prospectId, stoppedAt: null },
    data: { stoppedAt: at, stopReason: reason },
  });
  await tx.smsOutreachMessage.updateMany({
    where: { contact: { prospectId }, status: { in: ["DRAFT", "APPROVED"] } },
    data: { status: "SKIPPED" },
  });
  await tx.smsOutreachContact.updateMany({
    where: { prospectId, stoppedAt: null },
    data: { stoppedAt: at, stopReason: reason },
  });
  if (opposition) {
    const emails = new Set(
      [p.email, ...p.emailLeads.map((l) => l.email)].filter(
        (x): x is string => !!x,
      ),
    );
    for (const email of emails)
      await tx.outreachSuppression.upsert({
        where: { emailHash: emailHash(email) },
        update: {},
        create: { emailHash: emailHash(email), reason },
      });
    for (const value of [p.phone, p.smsContact?.phone]) {
      let phone: string;
      try {
        phone = mobileNumber(value || "");
      } catch {
        continue;
      }
      await tx.smsSuppression.upsert({
        where: { phoneHash: hash(phone) },
        update: {},
        create: { phoneHash: hash(phone), reason },
      });
    }
    await tx.prospect.update({
      where: { id: prospectId },
      data: {
        doNotContactAt: p.doNotContactAt || at,
        stopReason: p.stopReason || reason,
        status: p.status === "CLIENT_SIGNE" ? p.status : "PAS_INTERESSE",
        nextFollowUpAt: null,
      },
    });
    await tx.followUp.updateMany({
      where: { prospectId, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
  }
}

export async function recordCrmEvent(
  tx: Prisma.TransactionClient,
  input: {
    prospectId?: string | null;
    key: string;
    channel: "SMS" | "EMAIL";
    kind: string;
    body: string;
    at?: Date;
  },
) {
  if (!input.prospectId) return;
  if (
    await tx.prospectInteraction.findUnique({
      where: { externalKey: input.key },
    })
  )
    return;
  const p = await tx.prospect.findUniqueOrThrow({
    where: { id: input.prospectId },
  });
  const at = input.at || new Date();
  const opposition = ["STOP", "UNSUBSCRIBED", "REFUSED"].includes(input.kind);
  const replied = input.kind === "REPLIED";
  await tx.prospectInteraction.create({
    data: {
      prospectId: p.id,
      externalKey: input.key,
      createdAt: at,
      type:
        input.kind === "SENT"
          ? input.channel === "SMS"
            ? "SMS_ENVOYE"
            : "EMAIL"
          : replied || opposition
            ? "REPONSE_RECUE"
            : "NOTE",
      note: `${input.channel === "SMS" ? "SMS" : "E-mail"} · ${input.kind === "SENT" ? "envoyé" : opposition ? "opposition" : replied ? "réponse reçue" : input.kind}\n${input.body.slice(0, 10000)}`,
    },
  });
  if (replied || opposition || ["BOUNCED", "CLOSED"].includes(input.kind))
    await stopCrmSequences(tx, p.id, input.kind, opposition);
  await tx.prospect.update({
    where: { id: p.id },
    data: {
      lastInteractionAt:
        !p.lastInteractionAt || at > p.lastInteractionAt
          ? at
          : p.lastInteractionAt,
      ...(input.kind === "SENT" && input.channel === "SMS" && !p.firstSmsSentAt
        ? { firstSmsSentAt: at }
        : {}),
      ...(!opposition && !p.doNotContactAt && openStatuses.includes(p.status)
        ? {
            status: replied
              ? "REPONDU"
              : input.kind === "SENT"
                ? "SANS_REPONSE"
                : p.status,
          }
        : {}),
    },
  });
  if (
    replied &&
    !p.doNotContactAt &&
    !(await tx.followUp.count({
      where: { prospectId: p.id, status: "PENDING" },
    }))
  ) {
    const dueAt = new Date(Date.now() + 86400000);
    await tx.followUp.create({
      data: {
        prospectId: p.id,
        dueAt,
        note: `Répondre personnellement à la réponse ${input.channel === "SMS" ? "SMS" : "e-mail"}.`,
      },
    });
    await tx.prospect.update({
      where: { id: p.id },
      data: { nextFollowUpAt: dueAt },
    });
  }
}

export async function prepareCrmChannel(
  prospectId: string,
  channel: "SMS" | "EMAIL",
  templateId?: string,
) {
  return prisma.$transaction(async (tx) => {
    await crmLock(tx);
    const p = await tx.prospect.findUniqueOrThrow({
      where: { id: prospectId },
      include: { smsContact: true, emailLeads: true },
    });
    const template = templateId
      ? await tx.crmMessageTemplate.findUniqueOrThrow({
          where: { id: templateId },
        })
      : null;
    if (template && template.channel !== channel)
      throw Error("Le modèle ne correspond pas au canal.");
    const smsBody =
      channel === "SMS"
        ? textSchema.parse(
            template
              ? renderCrmTemplate(template.body, p)
              : defaultSms(p.companyName),
          )
        : "";
    const drafts = crmEmailDrafts(p.companyName, p.city || "", p.businessType);
    if (template && channel === "EMAIL")
      drafts[0] = {
        step: 0,
        subject: renderCrmTemplate(
          template.subject || "Présentation de {{entreprise}}",
          p,
        ).slice(0, 180),
        text: renderCrmTemplate(template.body, p),
      };
    if (p.doNotContactAt)
      throw Error("Cette entreprise est sur la liste de non-contact.");
    if (!p.sourceUrl)
      throw Error(
        "Renseignez le lien de la source avant de préparer un message.",
      );
    if (await crmBlocksChannel(tx, p.id, channel))
      throw Error(
        "Cette fiche est arrêtée, déjà traitée ou réservée à l’autre canal.",
      );
    if (channel === "SMS") {
      const phone = mobileNumber(p.phone);
      if (p.smsContact)
        return { href: `/admin/prospection/sms?id=${p.smsContact.id}` };
      const other = await tx.smsOutreachContact.findUnique({
        where: { phone },
      });
      if (other && other.prospectId && other.prospectId !== p.id)
        throw Error("Ce mobile est déjà lié à une autre fiche.");
      const c = other
        ? await tx.smsOutreachContact.update({
            where: { id: other.id },
            data: { prospectId: p.id },
          })
        : await tx.smsOutreachContact.create({
            data: {
              prospectId: p.id,
              leadId: p.emailLeads[0]?.id,
              companyName: p.companyName,
              city: p.city || "À préciser",
              phone,
              sourceUrl: p.sourceUrl,
              websiteCheckUrl: `https://www.google.com/search?q=${encodeURIComponent(p.companyName + " " + (p.city || ""))}`,
              messages: { create: { body: smsBody } },
            },
          });
      return { href: `/admin/prospection/sms?id=${c.id}` };
    }
    if (!p.email) throw Error("Renseignez un courriel professionnel.");
    if (p.emailLeads[0])
      return { href: `/admin/prospection/outreach/${p.emailLeads[0].id}` };
    const campaign = await tx.outreachCampaign.upsert({
      where: { key: "crm-rhone-alpes" },
      update: {},
      create: {
        key: "crm-rhone-alpes",
        name: "CRM · Rhône-Alpes",
        enabled: false,
        targetLimit: 10000,
        exhausted: true,
      },
    });
    const lead = await tx.outreachLead.create({
      data: {
        prospectId: p.id,
        campaignId: campaign.id,
        siren: p.siren || `crm:${p.id}`,
        siret: p.siret || "",
        companyName: p.companyName,
        city: p.city || "",
        postalCode: p.department || "",
        activityCode: p.businessType || "",
        registryUrl: p.sourceUrl,
        contactSourceUrl: p.sourceUrl,
        sourceFetchedAt: p.sourceCheckedAt || p.createdAt,
        email: p.email,
        phone: p.phone || null,
        website: p.website,
        enrichmentState: "MANUAL",
        auditState: "MANUAL",
        messages: {
          create: drafts.map((m) => ({ ...m, messageId: newMessageId() })),
        },
      },
    });
    if (p.smsContact && !p.smsContact.leadId)
      await tx.smsOutreachContact.update({
        where: { id: p.smsContact.id },
        data: { leadId: lead.id },
      });
    return { href: `/admin/prospection/outreach/${lead.id}` };
  });
}

/** Attach legacy channel records without approving or scheduling any message. */
export async function linkLegacyCrm() {
  const leads = await prisma.outreachLead.findMany({ where: { prospectId: null }, take: 100, orderBy: { createdAt: "asc" } });
  let linked = 0;
  const conflicts: string[] = [];
  for (const lead of leads) {
    try {
      await prisma.$transaction(async (tx) => {
        await crmLock(tx);
        const current = await tx.outreachLead.findUniqueOrThrow({ where: { id: lead.id } });
        if (current.prospectId) return;
        const prospect = await ensureCrmProspect(tx, {
          companyName: current.companyName, siren: current.siren,
          phone: current.phone, email: current.email, city: current.city,
          website: current.website, sourceUrl: current.contactSourceUrl || current.registryUrl,
        });
        await tx.outreachLead.update({ where: { id: current.id }, data: { prospectId: prospect.id } });
        if (current.stoppedAt) await stopCrmSequences(tx, prospect.id, current.stopReason || "LEGACY_STOP", ["REFUSED", "UNSUBSCRIBED", "STOP"].includes(current.stopReason || ""));
        if (prospect.doNotContactAt) await stopCrmSequences(tx, prospect.id, prospect.stopReason || "STOP", true);
      });
      linked++;
    } catch { conflicts.push(lead.companyName); }
  }
  return { linked, conflicts, remaining: await prisma.outreachLead.count({ where: { prospectId: null } }) };
}
