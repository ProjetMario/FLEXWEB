import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const locations = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/locations" }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    type: z.enum(["department", "city", "region", "country"]),
    department: z.string().optional(),
    region: z.string(),
    country: z.string().default("France"),
    introduction: z.string(),
    localContext: z.string(),
    targetIndustries: z.array(z.string()).default([]),
    nearbyCities: z.array(z.string()).default([]),
    services: z.array(z.string()).default([]),
    faq: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    ).default([]),
    seoTitle: z.string(),
    seoDescription: z.string().max(160),
    isDraft: z.boolean().default(false),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/services" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    targetAudience: z.array(z.string()).default([]),
    benefits: z.array(z.string()).default([]),
    relatedLocations: z.array(z.string()).default([]),
    relatedServices: z.array(z.string()).default([]),
    seoTitle: z.string(),
    seoDescription: z.string().max(160),
    isDraft: z.boolean().default(false),
  }),
});

export const collections = { locations, services };
