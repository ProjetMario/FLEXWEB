import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  businessType: z.string().min(1, "Le type d'activité est requis"),
  adminEmail: z.string().email("Email de l'administrateur invalide"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const pageSectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("header"),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    imageUrl: z.string().url().optional(),
    align: z.enum(["left", "center", "right"]).default("center"),
  }),
  z.object({
    type: z.literal("text"),
    content: z.string().min(1),
    align: z.enum(["left", "center", "right"]).default("left"),
  }),
  z.object({
    type: z.literal("image"),
    imageUrl: z.string().url(),
    altText: z.string().optional(),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal("gallery"),
    images: z.array(
      z.object({
        url: z.string().url(),
        altText: z.string().optional(),
      })
    ),
  }),
  z.object({
    type: z.literal("services"),
    title: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(6),
  }),
  z.object({
    type: z.literal("products"),
    title: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(6),
  }),
  z.object({
    type: z.literal("testimonials"),
    title: z.string().optional(),
    limit: z.number().int().min(1).max(20).default(6),
  }),
  z.object({
    type: z.literal("team"),
    title: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(6),
  }),
  z.object({
    type: z.literal("faq"),
    title: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  z.object({
    type: z.literal("cta"),
    title: z.string().min(1),
    buttonText: z.string().min(1),
    buttonHref: z.string().min(1),
  }),
  z.object({
    type: z.literal("form"),
    formId: z.string().uuid(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("map"),
    address: z.string().min(1),
  }),
  z.object({
    type: z.literal("hours"),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("stats"),
    items: z.array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
      })
    ),
  }),
  z.object({
    type: z.literal("partners"),
    title: z.string().optional(),
    logos: z.array(z.object({ url: z.string().url(), name: z.string().optional() })),
  }),
  z.object({
    type: z.literal("recent-articles"),
    title: z.string().optional(),
    limit: z.number().int().min(1).max(20).default(3),
  }),
]);

export const pageSectionConfigSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()).default({}),
  order: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
});

export const pageSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Le slug est invalide"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  isHomepage: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  sections: z.array(pageSectionConfigSchema).default([]),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  role: z.enum(["ADMIN", "EDITOR"]),
});

export const createPageSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Le slug est invalide"),
  isHomepage: z.boolean(),
});

export const editPageSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  isHomepage: z.boolean(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type EditPageInput = z.infer<typeof editPageSchema>;

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export type PageSectionInput = z.infer<typeof pageSectionConfigSchema>;
export type PageInput = z.infer<typeof pageSchema>;
