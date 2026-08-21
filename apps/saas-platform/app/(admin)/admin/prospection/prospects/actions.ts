"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import { prospectSchema } from "@/lib/prospection/prospect-schema";
import { InteractionType, Prisma } from "@prisma/client";

export async function createProspect(formData: FormData) {
  const user = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = prospectSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const status = data.status ?? "NOUVEAU";

  try {
    const prospect = await prisma.prospect.create({
      data: {
        companyName: data.companyName,
        contactName: data.contactName || null,
        phone: data.phone,
        email: data.email || null,
        website: data.website || null,
        googleBusinessUrl: data.googleBusinessUrl || null,
        businessType: data.businessType || null,
        category: data.category || null,
        city: data.city || null,
        department: data.department || null,
        country: data.country || "France",
        source: data.source || null,
        googleReviewCount: data.googleReviewCount ?? null,
        googleRating: data.googleRating ?? null,
        internalNotes: data.internalNotes || null,
        status,
        estimatedValue: data.estimatedValue ?? null,
        setupFee: data.setupFee ?? null,
        monthlyPrice: data.monthlyPrice ?? null,
        oneTimePrice: data.oneTimePrice ?? null,
        campaignId: data.campaignId || null,
      },
    });

    await prisma.prospectInteraction.create({
      data: {
        prospectId: prospect.id,
        type: InteractionType.PROSPECT_AJOUTE,
        note: `Prospect ajouté par ${user.email}`,
        newStatus: status,
        createdById: user.id,
      },
    });

    revalidatePath("/admin/prospection/prospects");
    revalidatePath("/admin/prospection");
    redirect(`/admin/prospection/prospects/${prospect.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, errors: { companyName: ["Un prospect avec ce téléphone et ce nom existe déjà."] } };
    }
    throw error;
  }
}
