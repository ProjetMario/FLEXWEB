import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import offers from "./offers.json";

export const catalog = offers;
export const TERMS_VERSION = "2026-09-09";
export const stages: Record<string, string> = {
  NEW: "Demande à qualifier",
  AWAITING_PAYMENT: "Proposition validée",
  BRIEF: "Brief à compléter",
  DRAFT_READY: "Brouillon à contrôler",
  CLIENT_REVIEW: "Validation client",
  REVISION_REQUESTED: "Corrections demandées",
  APPROVED: "Prêt à publier",
  LIVE: "En ligne",
  CANCELED: "Projet arrêté",
};
export function offerFor(id: string) {
  const offer = offers.find((o) => o.id === id);
  if (!offer) throw new HttpError(400, "Offre inconnue.");
  return offer;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function secretMatches(
  actual: string | null,
  expected: string | undefined,
) {
  if (!actual || !expected || expected.length < 32) return false;
  return timingSafeEqual(
    Buffer.from(tokenHash(actual)),
    Buffer.from(tokenHash(expected)),
  );
}
const text = (max: number) => z.string().trim().min(1).max(max);
export const intakeSchema = z.object({
  requestKey: z.string().uuid(),
  accessToken: z.string().regex(/^[a-f0-9]{64}$/),
  companyName: text(160),
  contactName: text(120),
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{8,25}$/),
  city: text(100),
  businessType: text(100),
  planId: z.enum(["essentielle", "professionnelle", "croissance", "achat"]),
  message: z.string().trim().min(15).max(3000),
  timeline: z.enum(["rapidement", "1-3-mois", "a-definir"]),
  privacyConsent: z.literal(true),
  professional: z.literal(true),
  websiteTrap: z.string().max(0).default(""),
  source: z.string().max(160).default("site"),
});
export const briefSchema = z.object({
  description: z.string().trim().min(40).max(4000),
  services: z.array(text(160)).min(1).max(8),
  area: text(250),
  advantages: z.string().trim().min(10).max(1500),
  about: z.string().trim().min(30).max(3000),
  contactEmail: z.email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{8,25}$/),
  assetLink: z
    .union([
      z.literal(""),
      z
        .url()
        .max(1000)
        .refine((v) => v.startsWith("https://"), "Lien HTTPS requis"),
    ])
    .default(""),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#0071e3"),
  contentConfirmed: z.literal(true),
});
export type Brief = z.infer<typeof briefSchema>;
export function draftPages(company: string, brief: Brief) {
  const header = (title: string, subtitle = "") => ({
    type: "header",
    config: { title, subtitle },
    order: 0,
  });
  const paragraph = (content: string) => ({
    type: "text",
    config: { content },
    order: 1,
  });
  return [
    {
      slug: "accueil",
      title: "Accueil",
      isHomepage: true,
      sections: [
        header(company, brief.area),
        paragraph(brief.description),
        {
          type: "cta",
          config: {
            title: "Parlons de votre projet",
            buttonText: "Nous contacter",
            buttonHref: "/contact",
          },
          order: 2,
        },
      ],
    },
    {
      slug: "prestations",
      title: "Prestations",
      isHomepage: false,
      sections: [
        header("Nos prestations"),
        paragraph(brief.services.join(" · ")),
      ],
    },
    {
      slug: "a-propos",
      title: "À propos",
      isHomepage: false,
      sections: [header(`À propos de ${company}`), paragraph(brief.about)],
    },
    {
      slug: "engagements",
      title: "Nos engagements",
      isHomepage: false,
      sections: [header("Pourquoi nous choisir"), paragraph(brief.advantages)],
    },
    {
      slug: "contact",
      title: "Contact",
      isHomepage: false,
      sections: [
        header("Contactez-nous", brief.area),
        paragraph(`${brief.phone} — ${brief.contactEmail}`),
      ],
    },
  ];
}
export function projectedMrr(
  projects: { monthlyCents: number; paymentStatus: string; stage: string }[],
) {
  return projects
    .filter((p) => p.paymentStatus === "PAID" && p.stage !== "CANCELED")
    .reduce((sum, p) => sum + p.monthlyCents, 0);
}
