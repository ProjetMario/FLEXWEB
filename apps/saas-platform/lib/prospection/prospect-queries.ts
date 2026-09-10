import { prisma } from "@/lib/prisma";
import { ProspectionStatus, type Prisma } from "@prisma/client";

export type ProspectFilters = {
  query?: string;
  status?: ProspectionStatus;
  statuses?: string[];
  department?: string;
  qualification?: string;
  channel?: string;
  stopped?: string;
  city?: string;
  businessType?: string;
  campaignId?: string;
  page?: number;
  pageSize?: number;
  sortBy?:
    | "companyName"
    | "lastInteractionAt"
    | "nextFollowUpAt"
    | "createdAt"
    | "estimatedValue";
  sortOrder?: "asc" | "desc";
};

export async function getProspects(filters: ProspectFilters = {}) {
  const { query, status, city, businessType, campaignId } = filters;

  const page = Number.isFinite(filters.page)
    ? Math.min(10000, Math.max(1, Math.floor(filters.page!)))
    : 1;
  const pageSize = [25, 50, 100].includes(filters.pageSize || 0)
    ? filters.pageSize!
    : 25;
  const sortBy = [
    "companyName",
    "lastInteractionAt",
    "nextFollowUpAt",
    "createdAt",
    "estimatedValue",
  ].includes(filters.sortBy || "")
    ? filters.sortBy!
    : "lastInteractionAt";
  const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
  const where: Prisma.ProspectWhereInput = {};

  if (query) {
    where.OR = [
      { companyName: { contains: query, mode: "insensitive" } },
      { contactName: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
      { email: { contains: query, mode: "insensitive" } },
      { city: { contains: query, mode: "insensitive" } },
    ];
  }

  if (status && Object.values(ProspectionStatus).includes(status))
    where.status = status;
  const statuses = filters.statuses?.filter((s): s is ProspectionStatus =>
    Object.values(ProspectionStatus).includes(s as ProspectionStatus),
  );
  if (statuses?.length) where.status = { in: statuses };
  if (filters.department) where.department = filters.department;
  if (
    ["TO_CHECK", "NOT_FOUND", "HAS_WEBSITE", "CLOSED"].includes(
      filters.qualification || "",
    )
  )
    where.websiteFinding = filters.qualification;
  if (filters.channel === "SMS")
    where.AND = [
      {
        OR: [
          { phone: { startsWith: "+336" } },
          { phone: { startsWith: "+337" } },
        ],
      },
    ];
  if (filters.channel === "EMAIL") where.email = { not: null };
  if (filters.stopped === "yes") where.doNotContactAt = { not: null };
  if (filters.stopped === "no") where.doNotContactAt = null;
  if (city) where.city = { equals: city, mode: "insensitive" };
  if (businessType)
    where.businessType = { equals: businessType, mode: "insensitive" };
  if (campaignId) where.campaignId = campaignId;

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy:
        sortBy === "lastInteractionAt"
          ? [
              { lastInteractionAt: { sort: sortOrder, nulls: "last" } },
              { createdAt: sortOrder },
            ]
          : sortBy === "nextFollowUpAt"
            ? [
                { nextFollowUpAt: { sort: sortOrder, nulls: "last" } },
                { createdAt: sortOrder },
              ]
            : { [sortBy]: sortOrder },
      include: { campaign: { select: { name: true } } },
    }),
    prisma.prospect.count({ where }),
  ]);

  return {
    prospects,
    total,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
  };
}

export async function getProspectFilterOptions() {
  const [cities, businessTypes] = await Promise.all([
    prisma.prospect.groupBy({ by: ["city"], orderBy: { city: "asc" } }),
    prisma.prospect.groupBy({
      by: ["businessType"],
      orderBy: { businessType: "asc" },
    }),
  ]);

  return {
    cities: cities.map((c) => c.city).filter(Boolean) as string[],
    businessTypes: businessTypes
      .map((b) => b.businessType)
      .filter(Boolean) as string[],
  };
}
