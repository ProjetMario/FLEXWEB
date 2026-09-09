import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

export const SENDER = "contact@flex-web.fr";
export const PILOT_KEY = "plomberie-savoie-50";
export const stages: Record<string, string> = {
  NEW: "À vérifier",
  APPROVED: "Séquence validée",
  CONTACTED: "Contacté",
  REPLIED: "Réponse à lire",
  INTERESTED: "Intéressé",
  MEETING: "Rendez-vous",
  WON: "Client signé",
  REFUSED: "Refus",
  UNSUBSCRIBED: "Désinscrit",
  BOUNCED: "Adresse en erreur",
  CLOSED: "Classé",
  COMPLETE: "Séquence terminée",
};
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const emailHash = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export const newMessageId = () => `<outreach-${randomUUID()}@flex-web.fr>`;
export function optOutToken(id: string) {
  const secret = process.env.AUTOMATION_SHARED_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configuration de sécurité manquante.");
  return `${id}.${createHmac("sha256", secret).update(`outreach-optout:${id}`).digest("hex")}`;
}
export function readOptOutToken(token: string) {
  if (!/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) return null;
  const [id, signature] = token.split(".");
  if (
    !/^[a-f0-9-]{36}$/.test(id || "") ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    return null;
  const expected = optOutToken(id).split(".")[1];
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ? id
    : null;
}
export function parisTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    allowed:
      !["Sat", "Sun"].includes(p.weekday) &&
      Number(p.hour) >= 9 &&
      Number(p.hour) < 17,
  };
}
export function dueStep(
  step: number,
  firstSentAt: Date | null,
  lastSentAt: Date | null,
  now: Date,
) {
  if (step === 0) return !firstSentAt;
  if (!firstSentAt || !lastSentAt) return false;
  return (
    now.getTime() >= firstSentAt.getTime() + (step === 1 ? 4 : 10) * 86400000 &&
    now.getTime() - lastSentAt.getTime() >= 3 * 86400000
  );
}
export type Audit = {
  checkedAt: string;
  pages: string[];
  findings: { label: string; evidence: string }[];
  note: string;
};
export function draftMessages(
  company: string,
  city: string,
  audit: Audit | null,
) {
  const observation = audit?.findings[0]?.label;
  const intro = observation
    ? `Un contrôle technique des pages publiques de votre site a relevé ce point : ${observation.charAt(0).toLowerCase()}${observation.slice(1)}. Il reste à le vérifier dans le parcours complet de vos visiteurs.`
    : `Je vous contacte au sujet de la présentation de vos prestations de plomberie et chauffage à ${city}.`;
  const subject = `Présentation de ${company.slice(0, 100)} sur le web`;
  return [
    {
      step: 0,
      subject,
      text: `Bonjour,\n\n${intro}\n\nAvec FLEX-WEB, j’aide les entreprises à présenter leurs services et à recueillir des demandes de devis sur leur site. Seriez-vous intéressé par un diagnostic court, sans engagement, adapté à ${company} ?\n\nBonne journée,`,
    },
    {
      step: 1,
      subject: `Re: ${subject}`,
      text: `Bonjour,\n\nJe reviens vers vous concernant ma proposition de diagnostic pour ${company}. L’objectif serait d’identifier quelques améliorations concrètes pour faciliter les demandes de devis.\n\nEst-ce un sujet d’actualité pour vous ?\n\nBonne journée,`,
    },
    {
      step: 2,
      subject: `Re: ${subject}`,
      text: `Bonjour,\n\nDernier message au sujet de la présence web de ${company}. Si ce projet devient utile, vous pouvez me répondre ici ou consulter flex-web.fr.\n\nSans réponse, je clôturerai cette prise de contact.\n\nBonne continuation,`,
    },
  ];
}
export function signedText(
  lead: { id: string; contactSourceUrl: string | null },
  text: string,
) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || "https://flexweb-gestion.netlify.app";
  return `${text}\n\nFLEX-WEB, marque de Fleximmo — ${SENDER}\n93 chemin de la Combe, 73420 Voglans\nhttps://flex-web.fr\n\nVotre adresse professionnelle provient de : ${lead.contactSourceUrl}. Nous l’utilisons pour vous proposer un service en lien avec votre activité, sur la base de notre intérêt légitime. Vous pouvez demander accès, rectification ou suppression en répondant à ce message.\nPour ne plus être contacté, répondez STOP ou utilisez ce lien : ${base}/api/outreach/unsubscribe?token=${optOutToken(lead.id)}\nInformations : https://flex-web.fr/privacy/`;
}
