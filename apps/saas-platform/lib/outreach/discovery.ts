import { prisma } from "../prisma";
import {
  PILOT_KEY,
  emailSchema,
  draftMessages,
  newMessageId,
  type Audit,
} from "./core";
import { webUrl, auditWebsite } from "./web-audit";

export const RGE_API =
  "https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines";
async function publicJson(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(6500),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Annuaire indisponible (${response.status}).`);
  return response.json();
}
export async function pilot() {
  return prisma.outreachCampaign.upsert({
    where: { key: PILOT_KEY },
    update: {},
    create: {
      key: PILOT_KEY,
      name: "Plombiers et chauffagistes · Savoie et Haute-Savoie",
    },
  });
}
export type RegistryCompany = {
  siren: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  activite_principale: string;
  statut_diffusion: string;
  etat_administratif: string;
  nombre_etablissements: number;
  siege: {
    siret: string;
    code_postal: string;
    libelle_commune: string;
    etat_administratif: string;
    statut_diffusion_etablissement: string;
  };
};
export function eligibleCompany(c: RegistryCompany) {
  return (
    /^\d{9}$/.test(c.siren) &&
    /^\d{14}$/.test(c.siege?.siret) &&
    c.etat_administratif === "A" &&
    c.statut_diffusion === "O" &&
    c.siege.etat_administratif === "A" &&
    c.siege.statut_diffusion_etablissement === "O" &&
    /^(73|74)\d{3}$/.test(c.siege.code_postal) &&
    ["43.22A", "43.22B"].includes(c.activite_principale) &&
    c.nombre_etablissements <= 5
  );
}
export async function importRegistryPage() {
  const campaign = await pilot();
  const count = await prisma.outreachLead.count({
    where: { campaignId: campaign.id },
  });
  if (count >= campaign.targetLimit || campaign.exhausted) return false;
  const url = `https://recherche-entreprises.api.gouv.fr/search?activite_principale=43.22A,43.22B&departement=73,74&etat_administratif=A&per_page=25&page=${campaign.registryPage}`;
  const data = await publicJson(url);
  if (!Array.isArray(data.results))
    throw new Error("Réponse de l’annuaire invalide.");
  let room = campaign.targetLimit - count;
  for (const c of data.results as RegistryCompany[]) {
    if (!room || !eligibleCompany(c)) continue;
    const result = await prisma.outreachLead.createMany({
      skipDuplicates: true,
      data: [
        {
          campaignId: campaign.id,
          siren: c.siren,
          siret: c.siege.siret,
          companyName: (c.nom_raison_sociale || c.nom_complet).slice(0, 200),
          city: c.siege.libelle_commune,
          postalCode: c.siege.code_postal,
          activityCode: c.activite_principale,
          registryUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`,
        },
      ],
    });
    room -= result.count;
  }
  await prisma.outreachCampaign.update({
    where: { id: campaign.id },
    data: {
      registryPage: { increment: 1 },
      exhausted:
        !data.results.length ||
        campaign.registryPage >= (data.total_pages || 999) ||
        campaign.registryPage >= 100,
    },
  });
  return true;
}
export async function enrichNext() {
  const campaign = await pilot();
  const lead = await prisma.outreachLead.findFirst({
    where: { campaignId: campaign.id, enrichmentState: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (!lead) return false;
  const source = `${RGE_API}?size=20&qs=${encodeURIComponent(`siret:${lead.siret}`)}`;
  const data = await publicJson(source);
  if (!Array.isArray(data.results)) throw new Error("Réponse RGE invalide.");
  const rows = data.results.filter(
    (r: Record<string, string>) =>
      r.siret === lead.siret &&
      (!r.lien_date_fin || new Date(r.lien_date_fin).getTime() > Date.now()),
  );
  const row =
    rows.find((r: Record<string, string>) => r.site_internet) || rows[0];
  let website: string | null = null;
  try {
    if (row?.site_internet) website = webUrl(row.site_internet).href;
  } catch {
    /* Require a manual public URL. */
  }
  const emails = [
    ...new Set<string>(
      rows
        .map((r: Record<string, string>) => emailSchema.safeParse(r.email).data)
        .filter(Boolean),
    ),
  ];
  await prisma.outreachLead.update({
    where: { id: lead.id },
    data: {
      website,
      email: emails.length === 1 ? emails[0] : null,
      phone: row?.telephone?.slice(0, 40) || null,
      contactSourceUrl: row ? source : null,
      enrichmentState: row ? "FOUND" : "MANUAL",
      auditState: website ? "PENDING" : "MANUAL",
    },
  });
  if (!website) await prepareDrafts(lead.id, null);
  return true;
}
export async function prepareDrafts(id: string, audit: Audit | null) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OutreachLead" WHERE id=${id} FOR UPDATE`;
    const lead = await tx.outreachLead.findUniqueOrThrow({ where: { id } });
    if (lead.approvedAt || lead.stoppedAt || lead.firstSentAt) return;
    for (const draft of draftMessages(lead.companyName, lead.city, audit))
      await tx.outreachMessage.upsert({
        where: { leadId_step: { leadId: id, step: draft.step } },
        update: { subject: draft.subject, text: draft.text, status: "DRAFT" },
        create: { leadId: id, ...draft, messageId: newMessageId() },
      });
  });
}
export async function auditNext() {
  const campaign = await pilot();
  const lead = await prisma.outreachLead.findFirst({
    where: {
      campaignId: campaign.id,
      website: { not: null },
      auditState: "PENDING",
      approvedAt: null,
      stoppedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
  if (!lead) return false;
  let audit: Audit | null = null;
  try {
    audit = await auditWebsite(lead.website!);
  } catch (e) {
    await prisma.outreachLead.update({
      where: { id: lead.id },
      data: {
        auditState: "MANUAL",
        audit: {
          checkedAt: new Date().toISOString(),
          pages: [],
          findings: [],
          note: e instanceof Error ? e.message : "Contrôle manuel nécessaire.",
        },
        score: 0,
      },
    });
  }
  if (audit)
    await prisma.outreachLead.update({
      where: { id: lead.id },
      data: {
        auditState: "DONE",
        audit,
        score: Math.min(100, audit.findings.length * 25),
      },
    });
  await prepareDrafts(lead.id, audit);
  return true;
}

export async function refreshRegistry(id: string) {
  const lead = await prisma.outreachLead.findUniqueOrThrow({
    where: { id },
    include: { messages: true },
  });
  if (lead.stoppedAt || lead.messages.some((m) => m.attemptedAt))
    throw new Error("La fiche possède un historique à conserver.");
  const data = await publicJson(
    `https://recherche-entreprises.api.gouv.fr/search?q=${lead.siren}&per_page=1`,
  );
  const company = data.results?.find(
    (c: RegistryCompany) => c.siren === lead.siren,
  );
  if (!company || !eligibleCompany(company))
    throw new Error(
      "Cette entreprise ne remplit plus les critères publics de la campagne. Classez la fiche sans suite.",
    );
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "OutreachLead" WHERE id=${id} FOR UPDATE`;
    const current = await tx.outreachLead.findUniqueOrThrow({
      where: { id },
      include: { messages: true },
    });
    if (current.stoppedAt || current.messages.some((m) => m.attemptedAt))
      throw new Error("La fiche vient d’être prise en charge.");
    await tx.outreachLead.update({
      where: { id },
      data: {
        sourceFetchedAt: new Date(),
        approvedAt: null,
        approvedBy: null,
        stage: "NEW",
      },
    });
    await tx.outreachMessage.updateMany({
      where: { leadId: id, status: "APPROVED" },
      data: { status: "DRAFT" },
    });
    await tx.outreachEvent.create({
      data: {
        leadId: id,
        type: "REFRESHED",
        detail:
          "Activité et diffusion publique revérifiées ; nouvelle validation des messages requise.",
      },
    });
  });
}
