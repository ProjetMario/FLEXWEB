import { notFound } from "next/navigation";
import SiteView from "@/components/studio/SiteView";
import { publicStudio } from "@/lib/studio/public";
import { PUBLIC } from "@/lib/studio/core";
export const dynamic = "force-dynamic";
type Params = Promise<{ siteSlug: string; page?: string[] }>;
export async function generateMetadata({ params }: { params: Params }) {
  const { siteSlug, page } = await params;
  const { site, data } = await publicStudio(siteSlug, page?.[0] || "accueil");
  const base =
    site.domainState === "VERIFIED"
      ? `https://${site.domain}`
      : `${PUBLIC()}/sites/${site.slug}`;
  return {
    title: {
      absolute: `${data.brief.company} — ${data.brief.activity} à ${data.brief.city}`,
    },
    description: data.brief.description.slice(0, 160),
    alternates: { canonical: base + (page?.[0] ? `/${page[0]}` : "/") },
  };
}
export default async function Page({ params }: { params: Params }) {
  const { siteSlug, page } = await params;
  if (page && page.length > 1) notFound();
  const { site, data } = await publicStudio(siteSlug, page?.[0] || "accueil");
  return (
    <SiteView
      data={data}
      siteId={site.id}
      basePath={`/sites/${site.slug}`}
      pageSlug={page?.[0] || "accueil"}
    />
  );
}
