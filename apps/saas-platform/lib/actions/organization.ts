"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createOrganizationSchema, type CreateOrganizationInput } from "@/lib/zod";
import { hasPermission } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function createOrganization(input: CreateOrganizationInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Non authentifié" };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, role: "SUPER_ADMIN" },
  });

  if (!membership || !hasPermission(membership.role, "organizations:create")) {
    return { error: "Permission refusée" };
  }

  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides", issues: parsed.error.flatten().fieldErrors };
  }

  const { name, slug, businessType, adminEmail } = parsed.data;

  try {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return { error: "Ce slug est déjà utilisé" };
    }

    const passwordHash = await bcrypt.hash("Password123!", 12);

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        businessType,
        status: "TRIAL",
      },
    });

    await prisma.website.create({
      data: {
        organizationId: organization.id,
        name: `Site ${name}`,
        isPublished: false,
      },
    });

    const user = await prisma.user.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: {},
      create: {
        email: adminEmail.toLowerCase(),
        name: "Administrateur",
        passwordHash,
        emailVerified: new Date(),
      },
    });

    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: { role: "ADMIN" },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: "ADMIN",
      },
    });

    revalidatePath("/dashboard/admin/organizations");

    return { organization };
  } catch (error) {
    console.error("createOrganization error:", error);
    return { error: "Une erreur est survenue lors de la création" };
  }
}
