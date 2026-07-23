import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { TenantContext } from "@/types";

export async function getTenantFromRequest(): Promise<TenantContext | null> {
  const headersList = await headers();
  const host = headersList.get("host");

  if (!host) return null;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const isCustomDomain = !rootDomain || !host.endsWith(rootDomain);

  if (isCustomDomain) {
    const domainRecord = await prisma.domain.findUnique({
      where: { domain: host },
      include: { organization: true },
    });

    if (!domainRecord) return null;

    return {
      organizationId: domainRecord.organizationId,
      slug: domainRecord.organization.slug,
      isCustomDomain: true,
      domain: host,
    };
  }

  const subdomain = host.replace(`.${rootDomain}`, "").split(":")[0];

  if (!subdomain || subdomain === "www") return null;

  const organization = await prisma.organization.findUnique({
    where: { slug: subdomain },
  });

  if (!organization) return null;

  return {
    organizationId: organization.id,
    slug: organization.slug,
    isCustomDomain: false,
    domain: host,
  };
}

export function isDashboardHost(host: string): boolean {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain) return true;
  return host === rootDomain || host === `www.${rootDomain}`;
}
