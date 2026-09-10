import { customStudio } from "@/lib/studio/public";
import SiteView from "@/components/studio/SiteView";
import type { Snapshot } from "@/lib/studio/core";
import { notFound } from "next/navigation";
import { getTenantFromRequest } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { PageBlockRenderer } from "@/components/public/page-block-renderer";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await customStudio();
  if(studio) {const data=studio.published as unknown as Snapshot;return {title:data.brief.company,description:data.brief.description.slice(0,160)};}
  const tenant = await getTenantFromRequest();
  if (!tenant) return { title: "Site introuvable" };

  const page = await prisma.page.findFirst({
    where: {
      organizationId: tenant.organizationId,
      isHomepage: true,
      status: "PUBLISHED",
    },
  });

  if (!page) return { title: "Page introuvable" };

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription,
  };
}

export default async function PublicHomePage() {
  const studio = await customStudio();
  if(studio) return <SiteView data={studio.published as unknown as Snapshot} siteId={studio.id}/>;
  const tenant = await getTenantFromRequest();

  if (!tenant) {
    notFound();
  }

  const page = await prisma.page.findFirst({
    where: {
      organizationId: tenant.organizationId,
      isHomepage: true,
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
