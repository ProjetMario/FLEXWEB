import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

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

const national = defineCollection({
 loader: file('./src/data/national/articles.json', {parser: text => JSON.parse(text).map(entry => ({id:entry.slug,...entry}))}),
 schema: z.object({
  axis:z.enum(['sites','automatisation']),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title:z.string().min(15),description:z.string().min(40).max(170),intent:z.string(),
  locationTerms:z.array(z.string()).optional(),
  audience:z.string().min(5),problem:z.string().min(10),outcome:z.string().min(10),publicationSelected:z.boolean().default(false),reviewHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),
  status:z.enum(['draft','reviewed']),reviewedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),reviewer:z.string().min(3),
  evidenceKind:z.literal('editorial-recommendation'),demandEvidence:z.enum(['hypothesis','gsc-related-query']),
  intro:z.string().min(80),sections:z.array(z.object({title:z.string(),text:z.string().min(100)})).min(3),
  example:z.string().min(60),checklist:z.array(z.string()).min(3),limits:z.string().min(60),related:z.array(z.string()).min(1),
  sources:z.array(z.object({label:z.string(),url:z.string().url(),checkedAt:z.string()})).min(1),
 }),
});
export const collections = { locations, services, national };
