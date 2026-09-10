import { z } from "zod";
import type { StudioSite } from "@prisma/client";
export const APP = () =>
  (process.env.STUDIO_APP_URL || "https://flexweb-gestion.netlify.app").replace(
    /\/$/,
    "",
  );
export const PUBLIC = () =>
  (process.env.MARKETING_URL || "https://flex-web.fr").replace(/\/$/, "");
export const DAY = 86400000;
export const PRICE = 4900;
export const TERMS = "autonome-2026-09-10";
export const MODEL = "gpt-4.1-mini";
export const PAGE_NAMES = [
  "Accueil",
  "Prestations",
  "Présentation",
  "Réalisations",
  "Contact",
];
export const PAGE_SLUGS = [
  "accueil",
  "prestations",
  "presentation",
  "realisations",
  "contact",
];
const text = (max: number) => z.string().trim().max(max);
export const briefSchema = z.object({
  company: text(120).min(2),
  activity: text(120).min(2),
  city: text(120).min(2),
  description: text(2000).min(20),
  services: text(2000).min(5),
  about: text(2000),
  phone: text(25).regex(/^[+\d ().-]{8,25}$/),
  email: z.email().max(200),
  area: text(300),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  theme: z.enum(["atelier", "essentiel", "nature"]),
  legalName: text(180),
  address: text(400),
  siren: text(9).regex(/^\d{9}$|^$/),
  legalForm: text(120),
  contactName: text(100),
  logoId: z.string().uuid().or(z.literal("")),
});
export const sectionSchema = z.object({
  title: text(180),
  body: text(5000),
  imageId: z.string().uuid().or(z.literal("")),
});
export const draftSchema = z
  .object({
    tagline: text(180),
    pages: z
      .array(
        z.object({
          slug: z.enum([
            "accueil",
            "prestations",
            "presentation",
            "realisations",
            "contact",
          ]),
          title: text(80),
          sections: z.array(sectionSchema).max(8),
        }),
      )
      .length(5),
  })
  .refine(
    (d) => new Set(d.pages.map((p) => p.slug)).size === 5,
    "Chaque page doit être unique.",
  );
export type Brief = z.infer<typeof briefSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Snapshot = { brief: Brief; content: Draft };
export function baseDraft(b: Brief): Draft {
  return {
    tagline: b.activity + " à " + b.city,
    pages: PAGE_SLUGS.map((slug, i) => ({
      slug: slug as Draft["pages"][number]["slug"],
      title: PAGE_NAMES[i],
      sections: [
        {
          title: i === 0 ? b.company : PAGE_NAMES[i],
          body: [
            b.description,
            b.services,
            b.about,
            "",
            `${b.phone}\n${b.email}\n${b.area}`,
          ][i],
          imageId: "",
        },
      ],
    })),
  };
}
export function paid(
  s: Pick<StudioSite, "billingStatus" | "paidThrough" | "pastDueAt">,
  now = new Date(),
) {
  return (
    (s.billingStatus === "ACTIVE" && !!s.paidThrough && s.paidThrough > now) ||
    (s.billingStatus === "PAST_DUE" &&
      !!s.pastDueAt &&
      now.getTime() < s.pastDueAt.getTime() + 7 * DAY)
  );
}
export function editable(s: StudioSite, now = new Date()) {
  return paid(s, now) || s.trialEndsAt > now;
}
export function visible(s: StudioSite, now = new Date()) {
  return s.state === "LIVE" && !!s.published && paid(s, now);
}
export function publicationErrors(b: Brief, d: Draft) {
  const errors: string[] = [];
  if (!b.legalName || !b.address || !b.siren || !b.legalForm || !b.contactName)
    errors.push(
      "Complétez les informations légales et le responsable de publication.",
    );
  if (
    !d.pages
      .find((p) => p.slug === "accueil")
      ?.sections.some((s) => s.body.length >= 20)
  )
    errors.push("Complétez la page d’accueil.");
  if (
    !d.pages
      .find((p) => p.slug === "prestations")
      ?.sections.some((s) => s.body.length >= 5)
  )
    errors.push("Présentez vos prestations.");
  return errors;
}
export const snapshot = (s: StudioSite): Snapshot => ({
  brief: briefSchema.parse(s.brief),
  content: draftSchema.parse(s.draft),
});
export function assetIds(s: Snapshot) {
  return [
    s.brief.logoId,
    ...s.content.pages.flatMap((p) => p.sections.map((v) => v.imageId)),
  ].filter(Boolean);
}
