"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export async function publishWebsite(slug: string, websiteId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug },
    },
    include: {
      organization: { include: { websites: { where: { id: websiteId } } } },
    },
  });

  const website = membership?.organization.websites[0];

  if (!membership || !website || !hasPermission(membership.role, "websites:manage")) {
    return;
  }

  try {
    await prisma.website.update({
      where: { id: websiteId },
      data: { isPublished: true },
    });

    revalidatePath(`/dashboard/${slug}/site`);
    return;
  } catch (error) {
    console.error("publishWebsite error:", error);
    return;
  }
}

export async function unpublishWebsite(slug: string, websiteId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug },
    },
    include: {
      organization: { include: { websites: { where: { id: websiteId } } } },
    },
  });

  const website = membership?.organization.websites[0];

  if (!membership || !website || !hasPermission(membership.role, "websites:manage")) {
    return;
  }

  try {
    await prisma.website.update({
      where: { id: websiteId },
      data: { isPublished: false },
    });

    revalidatePath(`/dashboard/${slug}/site`);
    return;
  } catch (error) {
    console.error("unpublishWebsite error:", error);
    return;
  }
}
