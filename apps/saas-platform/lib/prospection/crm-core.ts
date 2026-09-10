import { createHash } from "node:crypto";
import { z } from "zod";

export const WEBSITE_LABELS: Record<string, string> = {
  TO_CHECK: "À qualifier",
  NOT_FOUND: "Aucun site trouvé après recherche",
  HAS_WEBSITE: "Site existant",
  CLOSED: "Activité fermée",
};
export const CHANNEL_LABELS: Record<string, string> = {
  NONE: "Non choisi",
  SMS: "SMS",
  EMAIL: "E-mail",
};
export function normalizePhone(value: string) {
  let n = value.replace(/[\s().-]/g, "");
  if (!n) return "";
  if (n.startsWith("0033")) n = "+33" + n.slice(4);
  if (/^0[1-9]\d{8}$/.test(n)) n = "+33" + n.slice(1);
  if (/^33[1-9]\d{8}$/.test(n)) n = "+" + n;
  if (!/^\+33[1-9]\d{8}$/.test(n)) throw Error("Téléphone français invalide.");
  return n;
}
const clean = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""));
const optional = clean.optional().default("");
export const importRow = z
  .object({
    entreprise: clean.pipe(z.string().min(2).max(200)),
    activite: optional,
    departement: optional,
    commune: optional,
    telephone: optional.transform(normalizePhone),
    email: optional
      .transform((v) => v.toLowerCase())
      .refine((v) => !v || z.email().safeParse(v).success, "Courriel invalide"),
    siren: optional.refine((v) => !v || /^\d{9}$/.test(v), "SIREN invalide"),
    siret: optional.refine((v) => !v || /^\d{14}$/.test(v), "SIRET invalide"),
    source: optional,
    url_source: clean.pipe(
      z
        .url()
        .refine(
          (v) => v.startsWith("https://"),
          "Une source HTTPS est nécessaire",
        ),
    ),
    date_collecte: optional.refine(
      (v) =>
        !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))),
      "Date invalide",
    ),
    etat_registre: optional,
    notes: optional,
  })
  .refine(
    (v) => !v.siren || !v.siret || v.siret.startsWith(v.siren),
    "SIREN et SIRET contradictoires",
  );
export type ImportRow = z.infer<typeof importRow>;
export function renderCrmTemplate(
  body: string,
  p: {
    companyName: string;
    city?: string | null;
    businessType?: string | null;
  },
) {
  return body.replace(
    /\{\{(entreprise|ville|activite)\}\}/g,
    (_, key: string) =>
      ({
        entreprise: p.companyName,
        ville: p.city || "",
        activite: p.businessType || "",
      })[key as "entreprise" | "ville" | "activite"],
  );
}
export function importIdentity(r: ImportRow) {
  return createHash("sha256")
    .update(r.siren ? `siren:${r.siren}` : `source:${r.url_source}`)
    .digest("hex");
}
export { parseCsv, csvCell } from "./crm-csv";
export function crmEmailDrafts(
  company: string,
  city: string,
  activity?: string | null,
) {
  const intro = `Je vous contacte au sujet de la présentation de ${company} et de vos prestations${city ? ` à ${city}` : ""}.`;
  return [
    {
      step: 0,
      subject: `Un site pour ${company.slice(0, 100)}`,
      text: `Bonjour,\n\n${intro}\n\nAvec FLEX-WEB, je crée des sites pour présenter les services${activity ? ` (${activity})` : ""}, les réalisations et faciliter les demandes de devis. Est-ce un sujet que vous souhaitez développer ? Je peux vous proposer un exemple adapté à votre entreprise.\n\nBonne journée,`,
    },
    {
      step: 1,
      subject: `Votre présence sur le web — ${company.slice(0, 90)}`,
      text: `Bonjour,\n\nJe reviens sur ma proposition de site pour ${company}. L’idée est de présenter clairement vos prestations et de faciliter les demandes de vos futurs clients. Souhaitez-vous en discuter quelques minutes ?\n\nBonne journée,`,
    },
    {
      step: 2,
      subject: `Dernier message — ${company.slice(0, 100)}`,
      text: `Bonjour,\n\nJe termine mon suivi concernant un éventuel site pour ${company}. Si ce projet devient utile, vous pouvez répondre à cet e-mail. Sans réponse, je ne vous relancerai plus dans cette séquence.\n\nBonne journée,`,
    },
  ];
}
