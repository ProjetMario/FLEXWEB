import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import offers from "./offers.json";
import publicQuotes from "./public-quotes.json";

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
export const publicQuoteSchema = z.discriminatedUnion("service", [
  z.object({
    version: z.literal("2026-09-11"),
    service: z.literal("site"),
    tier: z.enum(["simple", "complete"]),
    options: z.array(z.enum(["maintenance", "crm"])).max(2)
      .refine((options) => new Set(options).size === options.length, "Option dupliquée."),
  }).strict(),
  z.object({ version: z.literal("2026-09-11"), service: z.literal("automation") }).strict(),
  z.object({ version: z.literal("2026-09-11"), service: z.literal("application") }).strict(),
]);
export type PublicQuote = z.infer<typeof publicQuoteSchema>;

/** Prices are derived on the server; the browser selects only a tier/options. */
export function offerForIntake(data: { planId: string; publicQuote?: PublicQuote }) {
  if (!data.publicQuote) return offerFor(data.planId);
  const selection = publicQuoteSchema.parse(data.publicQuote);
  if (selection.service !== "site") return {
    id: "achat", name: selection.service === "automation" ? "Automatisation IA sur mesure" : "Application web ou mobile",
    setupCents: 0, monthlyCents: 0, pages: 0, supportMinutes: 0,
    features: ["Prestation sur mesure à chiffrer", "Périmètre, budget et calendrier à confirmer dans un devis distinct"],
    publicQuote: selection, quoteOnly: true,
  };
  const website = publicQuotes.websiteOffers.find((offer) => offer.tier === selection.tier)!;
  const options = publicQuotes.options.filter((option) => selection.options.includes(option.id as "maintenance" | "crm"));
  return {
    ...website,
    monthlyCents: options.reduce((sum, option) => sum + option.monthlyCents, 0),
    features: [...website.features, ...options.map((option) => `Option ${option.name} : ${option.monthlyCents / 100} € HT/mois. ${option.description}`)],
    publicQuote: selection, quoteOnly: false,
  };
}

export function requiresManualQuote(snapshot: unknown): boolean {
  return !!snapshot && typeof snapshot === "object" && "quoteOnly" in snapshot && snapshot.quoteOnly === true;
}
export function assertStandardQuote(snapshot: unknown): void {
  if (requiresManualQuote(snapshot)) throw new HttpError(409,
    "Cette prestation nécessite un devis sur mesure. Préparez et faites accepter un devis distinct ; la qualification et le paiement automatiques sont indisponibles pour ce projet.");
}

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
  publicQuote: publicQuoteSchema.optional(),
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
