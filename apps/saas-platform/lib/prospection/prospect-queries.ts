import { prisma } from "@/lib/prisma";
import type { ProspectionStatus } from "@prisma/client";

export type ProspectFilters = {
  query?: string;
  status?: ProspectionStatus;
  city?: string;
  businessType?: string;
  campaignId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "companyName" | "lastInteractionAt" | "nextFollowUpAt" | "createdAt" | "estimatedValue";
  sortOrder?: "asc" | "desc";
};

export async function getProspects(filters: ProspectFilters = {}) {
  const {
    query,
    status,
    city,
    businessType,
    campaignId,
    page = 1,
    pageSize = 25,
    sortBy = "lastInteractionAt",
    sortOrder = "desc",
  } = filters;

  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { companyName: { contains: query, mode: "insensitive" } },
      { contactName: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
      { email: { contains: query, mode: "insensitive" } },
      { city: { contains: query, mode: "insensitive" } },
    ];
  }

  if (status) where.status = status;
  if (city) where.city = { equals: city, mode: "insensitive" };
  if (businessType) where.businessType = { equals: businessType, mode: "insensitive" };
  if (campaignId) where.campaignId = campaignId;

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: sortBy === "lastInteractionAt"
        ? [{ lastInteractionAt: { sort: sortOrder, nulls: "last" } }, { createdAt: sortOrder }]
        : sortBy === "nextFollowUpAt"
        ? [{ nextFollowUpAt: { sort: sortOrder, nulls: "last" } }, { createdAt: sortOrder }]
        : { [sortBy]: sortOrder },
      include: { campaign: { select: { name: true } } },
    }),
    prisma.prospect.count({ where }),
  ]);

  return { prospects, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
}

export async function getProspectFilterOptions() {
  const [cities, businessTypes] = await Promise.all([
    prisma.prospect.groupBy({ by: ["city"], orderBy: { city: "asc" } }),
    prisma.prospect.groupBy({ by: ["businessType"], orderBy: { businessType: "asc" } }),
  ]);

  return {
    cities: cities.map((c) => c.city).filter(Boolean) as string[],
    businessTypes: businessTypes.map((b) => b.businessType).filter(Boolean) as string[],
  };
}
