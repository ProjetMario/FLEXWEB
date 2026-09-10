import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "../prisma";
import { visible, type Snapshot, PUBLIC, APP } from "./core";
export async function customStudio() {
  const host = (await headers()).get("host")?.split(":")[0].toLowerCase();
  if (
    !host ||
    host === new URL(APP()).hostname ||
    host === new URL(PUBLIC()).hostname
  )
    return null;
  const s = await prisma.studioSite.findUnique({ where: { domain: host } });
  if (!s || s.domainState !== "VERIFIED") return null;
  if (!visible(s)) notFound();
  return s;
}
export async function publicStudio(slug: string, page = "accueil") {
  const s = await prisma.studioSite.findUnique({ where: { slug } });
  if (!s || !visible(s)) notFound();
  const data = s.published as unknown as Snapshot;
  if (
    page !== "mentions-legales" &&
    !data.content.pages.some(
      (p) =>
        p.slug === page &&
        (p.slug !== "realisations" ||
          p.sections.some((x) => x.body || x.imageId)),
    )
  )
    notFound();
  return { site: s, data };
}
