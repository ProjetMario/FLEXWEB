import { notFound } from "next/navigation";
import { getTenantFromRequest } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { PageBlockRenderer } from "@/components/public/page-block-renderer";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const tenant = await getTenantFromRequest();
  const { slug } = await params;
  const pageSlug = slug[0] ?? "";

  if (!tenant) return { title: "Site introuvable" };

  const page = await prisma.page.findFirst({
    where: {
      organizationId: tenant.organizationId,
      slug: pageSlug,
      status: "PUBLISHED",
    },
  });

  if (!page) return { title: "Page introuvable" };

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription,
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const tenant = await getTenantFromRequest();
  const { slug } = await params;
  const pageSlug = slug[0] ?? "";

  if (!tenant) {
    notFound();
  }

  const page = await prisma.page.findFirst({
    where: {
      organizationId: tenant.organizationId,
      slug: pageSlug,
      status: "PUBLISHED",
    },
    include: {
      sections: {
        where: { isVisible: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!page) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageBlockRenderer sections={page.sections} organizationId={tenant.organizationId} />
    </div>
  );
}
