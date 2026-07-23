"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/zod";
import { hasPermission } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function inviteMember(slug: string, input: InviteMemberInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Non authentifié" };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug },
    },
    include: { organization: true },
  });

  if (!membership || !hasPermission(membership.role, "users:invite")) {
    return { error: "Permission refusée" };
  }

  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides", issues: parsed.error.flatten().fieldErrors };
  }

  const { email, role } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash("Password123!", 12);

    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: {
        email: email.toLowerCase(),
        name: email.split("@")[0],
        passwordHash,
        emailVerified: new Date(),
      },
    });

    const existingMembership = await prisma.membership.findFirst({
      where: {
        organizationId: membership.organizationId,
        userId: user.id,
      },
    });

    if (existingMembership) {
      await prisma.membership.update({
        where: { id: existingMembership.id },
        data: { role },
      });
    } else {
      await prisma.membership.create({
        data: {
          organizationId: membership.organizationId,
          userId: user.id,
          role,
        },
      });
    }

    revalidatePath(`/dashboard/${slug}/settings`);

    return { success: true, user: { id: user.id, email: user.email, role } };
  } catch (error) {
    console.error("inviteMember error:", error);
    return { error: "Une erreur est survenue lors de l'invitation" };
  }
}

export async function removeMember(slug: string, membershipId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug },
    },
  });

  if (!membership || !hasPermission(membership.role, "users:manage")) {
    return;
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: membership.organizationId },
  });

  if (!target || target.userId === session.user.id) {
    return;
  }

  try {
    await prisma.membership.delete({ where: { id: membershipId } });
    revalidatePath(`/dashboard/${slug}/settings`);
    return;
  } catch (error) {
    console.error("removeMember error:", error);
    return;
  }
}
