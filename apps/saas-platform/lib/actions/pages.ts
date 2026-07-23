"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createPageSchema,
  editPageSchema,
  type CreatePageInput,
  type EditPageInput,
} from "@/lib/zod";
import { hasPermission } from "@/lib/permissions";

export async function createPage(slug: string, input: CreatePageInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Non authentifié" };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organization: { slug },
    },
    include: { organization: { include: { websites: true } } },
  });

  if (!membership || !hasPermission(membership.role, "pages:manage")) {
    return { error: "Permission refusée" };
  }

  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Données invalides", issues: parsed.error.flatten().fieldErrors };
  }

  const { title, slug: pageSlug, isHomepage } = parsed.data;
  const website = membership.organization.websites[0];

  if (!website) {
    return { error: "Aucun site web configuré" };
  }

  try {
    if (isHomepage) {
      await prisma.page.updateMany({
        where: { organizationId: membership.organizationId, websiteId: website.id },
        data: { isHomepage: false },
      });
    }

    const existing = await prisma.page.findUnique({
      where: {
        organizationId_websiteId_slug: {
          organizationId: membership.organizationId,
          websiteId: website.id,
          slug: pageSlug,
        },
      },
    });

    if (existing) {
      return { error: "Ce slug est déjà utilisé" };
    }

    const page = await prisma.page.create({
      data: {
        organizationId: membership.organizationId,
        websiteId: website.id,
        title,
        slug: pageSlug,
        isHomepage,
        status: "DRAFT",
      },
    });

    revalidatePath(`/dashboard/${slug}/pages`);

    return { page };
  } catch (error) {
    console.error("createPage error:", error);
    return { error: "Une erreur est survenue lors de la création" };
  }
}

async function getMembershipWithPage(slug: string, userId: string, pageId: string) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organization: { slug },
    },
    include: {
      organization: {
        include: {
          websites: {
            include: {
              pages: {
                where: { id: pageId },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) return null;
  const website = membership.organization.websites[0];
  const page = website?.pages[0];

  if (!page) return null;

  return { membership, website, page };
}

export async function publishPage(slug: string, pageId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const result = await getMembershipWithPage(slug, session.user.id, pageId);
  if (!result || !hasPermission(result.membership.role, "pages:publish")) {
    return;
  }

  try {
    await prisma.page.update({
      where: { id: pageId },
      data: { status: "PUBLISHED" },
    });

    revalidatePath(`/dashboard/${slug}/pages`);
    revalidatePath(`/dashboard/${slug}/site`);
    return;
  } catch (error) {
    console.error("publishPage error:", error);
    return;
  }
}

export async function unpublishPage(slug: string, pageId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const result = await getMembershipWithPage(slug, session.user.id, pageId);
  if (!result || !hasPermission(result.membership.role, "pages:manage")) {
    return;
  }

  try {
    await prisma.page.update({
      where: { id: pageId },
      data: { status: "DRAFT" },
    });

    revalidatePath(`/dashboard/${slug}/pages`);
    revalidatePath(`/dashboard/${slug}/site`);
    return;
  } catch (error) {
    console.error("unpublishPage error:", error);
    return;
  }
}

export async function updatePage(slug: string, pageId: string, input: EditPageInput) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const result = await getMembershipWithPage(slug, session.user.id, pageId);
  if (!result || !hasPermission(result.membership.role, "pages:manage")) {
    return;
  }

  const { membership, website, page } = result;

  const parsed = editPageSchema.safeParse(input);
  if (!parsed.success) {
    return;
  }

  const { title, status, isHomepage, metaTitle, metaDescription } = parsed.data;

  try {
    if (isHomepage && !page.isHomepage) {
      await prisma.page.updateMany({
        where: { organizationId: membership.organizationId, websiteId: website.id },
        data: { isHomepage: false },
      });
    }

    await prisma.page.update({
      where: { id: pageId },
      data: {
        title,
        status,
        isHomepage,
        metaTitle: metaTitle ?? null,
        metaDescription: metaDescription ?? null,
      },
    });

    revalidatePath(`/dashboard/${slug}/pages`);
    revalidatePath(`/dashboard/${slug}/site`);
    return;
  } catch (error) {
    console.error("updatePage error:", error);
    return;
  }
}

export async function deletePage(slug: string, pageId: string) {
  const session = await auth();
  if (!session?.user) {
    return;
  }

  const result = await getMembershipWithPage(slug, session.user.id, pageId);
  if (!result || !hasPermission(result.membership.role, "pages:manage")) {
    return;
  }

  try {
    await prisma.page.delete({ where: { id: pageId } });

    revalidatePath(`/dashboard/${slug}/pages`);
    revalidatePath(`/dashboard/${slug}/site`);
    redirect(`/dashboard/${slug}/pages`);
  } catch (error) {
    console.error("deletePage error:", error);
    return;
  }
}
