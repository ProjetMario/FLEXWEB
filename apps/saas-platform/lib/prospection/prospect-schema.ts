import { z } from "zod";
import { ProspectionStatus } from "@prisma/client";

export const prospectSchema = z.object({
  companyName: z.string().min(1, "Le nom de l'entreprise est requis"),
  contactName: z.string().optional(),
  phone: z.string().min(1, "Le téléphone est requis"),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  googleBusinessUrl: z.string().url().optional().or(z.literal("")),
  businessType: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  department: z.string().optional(),
  country: z.string().optional(),
  source: z.string().optional(),
  googleReviewCount: z.coerce.number().int().min(0).optional(),
  googleRating: z.coerce.number().min(0).max(5).optional(),
  internalNotes: z.string().optional(),
  status: z.enum(ProspectionStatus).optional(),
  estimatedValue: z.coerce.number().int().min(0).optional(),
  setupFee: z.coerce.number().int().min(0).optional(),
  monthlyPrice: z.coerce.number().int().min(0).optional(),
  oneTimePrice: z.coerce.number().int().min(0).optional(),
  campaignId: z.string().uuid().optional().or(z.literal("")),
});

export type ProspectFormValues = z.infer<typeof prospectSchema>;
