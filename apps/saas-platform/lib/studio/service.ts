import { randomUUID, createHash } from "node:crypto";
import { Prisma, type StudioSite } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../automation/core";
import { queueMessage } from "../automation/service";
import { crmLock, stopCrmSequences } from "../prospection/crm-service";
import { normalizePhone } from "../prospection/crm-core";
import {
  APP,
  DAY,
  briefSchema,
  draftSchema,
  baseDraft,
  editable,
  paid,
  publicationErrors,
  snapshot,
  assetIds,
} from "./core";
import type { Identity } from "./auth";
export const lockSite = (tx: Prisma.TransactionClient, id: string) =>
  tx.$executeRaw`SELECT id FROM "StudioSite" WHERE id=${id} FOR UPDATE`;
export async function ownSite(identity: Identity) {
  const site = await prisma.studioSite.findUnique({
    where: { identityId: identity.id },
  });
  if (!site) throw new HttpError(404, "Créez d’abord votre site.");
  return site;
}
export async function createSite(identity: Identity, input: unknown) {
  const b = briefSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`studio:${identity.id}`}))`;
    const existing = await tx.studioSite.findUnique({
      where: { identityId: identity.id },
    });
    if (existing) return existing;
    await crmLock(tx);
    const matches = await tx.prospect.findMany({
      where: { email: { equals: identity.email, mode: "insensitive" } },
      take: 2,
    });
    // Only a verified email can claim an existing CRM identity. A public name/phone alone is insufficient.
    const match = matches.length === 1 ? matches[0] : null;
    if (
      !match &&
      (await tx.prospect.findUnique({
        where: {
          phone_companyName: {
            phone: normalizePhone(b.phone),
            companyName: b.company,
          },
        },
      }))
    )
      throw new HttpError(
        409,
        "Cette entreprise possède déjà une fiche. Utilisez son adresse e-mail habituelle ou contactez FLEX-WEB pour vérifier votre accès.",
      );
    const prospect =
      match ||
      (await tx.prospect.create({
        data: {
          companyName: b.company,
          email: identity.email,
          phone: normalizePhone(b.phone),
          city: b.city,
          businessType: b.activity,
          source: "Essai autonome",
          status: "INTERESSE",
        },
      }));
    if (!prospect.doNotContactAt) {
      await stopCrmSequences(tx, prospect.id, "ESSAI_COMMENCE");
      await tx.prospect.update({
        where: { id: prospect.id },
        data: { status: "INTERESSE" },
      });
    }
    const id = randomUUID();
    const slug =
      (b.company
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 45) || "entreprise") +
      "-" +
      id.slice(0, 6);
    const org = await tx.organization.create({
      data: {
        name: b.company,
        slug: `studio-${id}`,
        businessType: b.activity,
        status: "TRIAL",
      },
    });
    const website = await tx.website.create({
      data: { organizationId: org.id, name: b.company },
    });
    const site = await tx.studioSite.create({
      data: {
        id,
        identityId: identity.id,
        email: identity.email,
        organizationId: org.id,
        websiteId: website.id,
        prospectId: prospect.id,
        slug,
        trialEndsAt: new Date(Date.now() + 14 * DAY),
        brief: b,
        draft: baseDraft(b),
      },
    });
    await tx.prospectInteraction.create({
      data: {
        prospectId: prospect.id,
        type: "NOTE",
        note: "Essai autonome commencé. Aucun envoi de prospection supplémentaire.",
      },
    });
    await tx.studioEvent.create({
      data: {
        siteId: id,
        key: `created:${id}`,
        kind: "TRIAL",
        detail: "Essai privé de 14 jours commencé.",
      },
    });
    return site;
  });
}
export async function checkAssets(
  tx: Prisma.TransactionClient,
  siteId: string,
  ids: string[],
) {
  const unique = [...new Set(ids)];
  if (
    unique.length !==
    (await tx.studioAsset.count({
      where: { siteId, id: { in: unique }, state: "READY" },
    }))
  )
    throw new HttpError(
      400,
      "Une photo n’appartient pas à ce site ou n’est pas prête.",
    );
}
export async function saveSite(
  identity: Identity,
  input: { brief: unknown; draft: unknown; revision: number },
) {
  const b = briefSchema.parse(input.brief),
    d = draftSchema.parse(input.draft),
    s = await ownSite(identity);
  return prisma.$transaction(async (tx) => {
    await lockSite(tx, s.id);
    const current = await tx.studioSite.findUniqueOrThrow({
      where: { id: s.id },
    });
    if (!editable(current))
      throw new HttpError(
        403,
        "L’essai est terminé. Souscrivez pour reprendre les modifications.",
      );
    if (current.draftRevision !== input.revision)
      throw new HttpError(
        409,
        "Une autre modification a été enregistrée. Actualisez avant de continuer.",
      );
    await checkAssets(tx, s.id, assetIds({ brief: b, content: d }));
    return tx.studioSite.update({
      where: { id: s.id },
      data: {
        brief: b,
        draft: d,
        draftRevision: { increment: 1 },
        approvedRevision: null,
      },
    });
  });
}
export async function publishSite(
  id: string,
  revision: number,
  restore = false,
) {
  return prisma.$transaction(async (tx) => {
    await lockSite(tx, id);
    const s = await tx.studioSite.findUniqueOrThrow({ where: { id } });
    if (!paid(s))
      throw new HttpError(
        409,
        "Un abonnement actif est nécessaire pour publier.",
      );
    if (s.draftRevision !== revision)
      throw new HttpError(
        409,
        "Le contenu a changé. Vérifiez la nouvelle version.",
      );
    const next = restore ? s.previousPublished : snapshot(s);
    if (!next)
      throw new HttpError(409, "Aucune version précédente à restaurer.");
    const parsed = next as unknown as ReturnType<typeof snapshot>;
    const errors = publicationErrors(
      briefSchema.parse(parsed.brief),
      draftSchema.parse(parsed.content),
    );
    if (errors.length) throw new HttpError(400, errors.join(" "));
    await checkAssets(tx, id, assetIds(parsed));
    await tx.studioSite.update({
      where: { id },
      data: {
        previousPublished: s.published || Prisma.DbNull,
        published: next as Prisma.InputJsonValue,
        state: "LIVE",
        publishedAt: new Date(),
        approvedRevision: revision,
        ...(restore
          ? {
              brief: parsed.brief,
              draft: parsed.content,
              draftRevision: { increment: 1 },
            }
          : {}),
      },
    });
    await tx.website.update({
      where: { id: s.websiteId },
      data: { isPublished: true },
    });
    await tx.organization.update({
      where: { id: s.organizationId },
      data: { status: "ACTIVE" },
    });
    await tx.studioEvent.create({
      data: {
        siteId: id,
        key: `publish:${randomUUID()}`,
        kind: "PUBLISHED",
        detail: restore
          ? "Version précédente restaurée."
          : "Site publié après validation du client.",
      },
    });
    if (s.prospectId)
      await tx.prospectInteraction.create({
        data: {
          prospectId: s.prospectId,
          type: "NOTE",
          note: "Site autonome publié.",
        },
      });
  });
}
export async function notifySite(
  s: StudioSite,
  key: string,
  subject: string,
  text: string,
) {
  await queueMessage({
    dedupeKey: `studio:${s.id}:${key}`,
    to: s.email,
    subject,
    text: `${text}\n\nVotre espace : ${APP()}/studio\nFLEX-WEB — contact@flex-web.fr`,
  });
}
export function visitorKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
