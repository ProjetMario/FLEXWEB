import { prisma } from "@/lib/prisma";
import { ProspectionStatus } from "@prisma/client";

export type StatsPeriod = "today" | "week" | "month" | "30days" | "all";

export function getPeriodBounds(period: StatsPeriod) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case "today":
      break;
    case "week":
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      break;
    case "month":
      start.setDate(1);
      break;
    case "30days":
      start.setDate(start.getDate() - 30);
      break;
    case "all":
      return { start: undefined, end: undefined };
  }

  return { start, end: now };
}

export async function getDashboardStats(period: StatsPeriod = "all") {
  const { start, end } = getPeriodBounds(period);
  const dateFilter = start && end ? { gte: start, lte: end } : undefined;
  const where = dateFilter ? { createdAt: dateFilter } : {};

  const [
    totalProspects,
    smsSent,
    noResponse,
    replied,
    interested,
    notInterested,
    followUpsDue,
    appointments,
    quotesSent,
    signedClients,
  ] = await Promise.all([
    prisma.prospect.count({ where }),
    prisma.smsOutreachMessage.count({
      where: { status: "SENT", ...(dateFilter ? { sentAt: dateFilter } : {}) },
    }),
    prisma.prospect.count({ where: { ...where, status: "SANS_REPONSE" } }),
    prisma.prospect.count({
      where: {
        ...where,
        status: {
          in: [
            "REPONDU",
            "INTERESSE",
            "RDV_PLANIFIE",
            "RDV_EFFECTUE",
            "DEVIS_ENVOYE",
            "NEGOCIATION",
            "CLIENT_SIGNE",
          ],
        },
      },
    }),
    prisma.prospect.count({
      where: {
        ...where,
        status: {
          in: [
            "INTERESSE",
            "RDV_PLANIFIE",
            "RDV_EFFECTUE",
            "DEVIS_ENVOYE",
            "NEGOCIATION",
            "CLIENT_SIGNE",
          ],
        },
      },
    }),
    prisma.prospect.count({
      where: { ...where, status: { in: ["PAS_INTERESSE", "PERDU"] } },
    }),
    prisma.followUp.count({
      where: {
        status: "PENDING",
        dueAt: { lte: new Date() },
      },
    }),
    prisma.appointment.count({
      where: {
        ...(dateFilter ? { date: dateFilter } : {}),
      },
    }),
    prisma.prospect.count({
      where: {
        ...where,
        status: { in: ["DEVIS_ENVOYE", "NEGOCIATION", "CLIENT_SIGNE"] },
      },
    }),
    prisma.prospect.count({ where: { ...where, status: "CLIENT_SIGNE" } }),
  ]);

  const responseRate = smsSent > 0 ? Math.round((replied / smsSent) * 100) : 0;
  const appointmentRate =
    smsSent > 0 ? Math.round((appointments / smsSent) * 100) : 0;
  const conversionRate =
    smsSent > 0 ? Math.round((signedClients / smsSent) * 100) : 0;

  const signedAgg = await prisma.prospect.aggregate({
    where: { ...where, status: "CLIENT_SIGNE" },
    _sum: { signedValue: true, monthlyPrice: true },
  });

  const estimatedAgg = await prisma.prospect.aggregate({
    where,
    _sum: { estimatedValue: true },
  });

  return {
    totalProspects,
    smsSent,
    noResponse,
    replied,
    interested,
    notInterested,
    followUpsDue,
    appointments,
    quotesSent,
    signedClients,
    responseRate,
    appointmentRate,
    conversionRate,
    signedRevenue: signedAgg._sum.signedValue ?? 0,
    mrr: signedAgg._sum.monthlyPrice ?? 0,
    estimatedPipeline: estimatedAgg._sum.estimatedValue ?? 0,
  };
}

const PIPELINE_STATUSES: ProspectionStatus[] = [
  "A_CONTACTER",
  "SMS_ENVOYE",
  "REPONDU",
  "INTERESSE",
  "RDV_PLANIFIE",
  "DEVIS_ENVOYE",
  "CLIENT_SIGNE",
];

export async function getPipelineStats() {
  const counts = await Promise.all(
    PIPELINE_STATUSES.map((status) =>
      prisma.prospect.count({ where: { status } }),
    ),
  );
  return PIPELINE_STATUSES.map((status, index) => ({
    status,
    count: counts[index],
  }));
}

export async function getStatusDistribution() {
  const group = await prisma.prospect.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return group
    .map((g) => ({ status: g.status, count: g._count.status }))
    .sort((a, b) => b.count - a.count);
}

export async function getRecentActivity(limit = 8) {
  return prisma.prospectInteraction.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      prospect: { select: { companyName: true } },
    },
  });
}

export async function getActionsToday() {
  const [newProspects, followUpsToday, appointmentsToday] = await Promise.all([
    prisma.prospect.count({
      where: {
        status: { in: ["NOUVEAU", "A_CONTACTER"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.followUp.count({
      where: {
        status: "PENDING",
        dueAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.appointment.count({
      where: {
        date: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return [
    {
      label: "Nouveaux prospects à contacter",
      value: newProspects,
      sub: "N'ont pas encore été contactés",
    },
    {
      label: "Prospects à relancer",
      value: followUpsToday,
      sub: "Relances prévues aujourd'hui",
    },
    {
      label: "Rendez-vous aujourd'hui",
      value: appointmentsToday,
      sub: "Ne pas oublier !",
    },
  ];
}

export async function getEvolutionData(days = 30) {
  const data: {
    date: string;
    sms: number;
    replies: number;
    appointments: number;
    clients: number;
  }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);

    const [sms, replies, apps, clients] = await Promise.all([
      prisma.prospectInteraction.count({
        where: { type: "SMS_ENVOYE", createdAt: { gte: date, lt: next } },
      }),
      prisma.prospectInteraction.count({
        where: { type: "REPONSE_RECUE", createdAt: { gte: date, lt: next } },
      }),
      prisma.prospectInteraction.count({
        where: { type: "RDV", createdAt: { gte: date, lt: next } },
      }),
      prisma.prospectInteraction.count({
        where: { type: "CLIENT_SIGNE", createdAt: { gte: date, lt: next } },
      }),
    ]);

    data.push({
      date: date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      sms,
      replies,
      appointments: apps,
      clients,
    });
  }

  return data;
}

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  "30days": "30 derniers jours",
  all: "Tous les temps",
};

export const STATUS_LABELS: Record<ProspectionStatus, string> = {
  NOUVEAU: "Nouveau",
  A_CONTACTER: "À contacter",
  SMS_ENVOYE: "SMS envoyé",
  SANS_REPONSE: "Sans réponse",
  REPONDU: "Répondu",
  INTERESSE: "Intéressé",
  A_RELANCER: "À relancer",
  RDV_PLANIFIE: "RDV planifié",
  RDV_EFFECTUE: "RDV effectué",
  DEVIS_ENVOYE: "Devis envoyé",
  NEGOCIATION: "Négociation",
  CLIENT_SIGNE: "Client signé",
  PAS_INTERESSE: "Pas intéressé",
  A_RECONTACTER_PLUS_TARD: "À recontacter plus tard",
  PERDU: "Perdu",
};
