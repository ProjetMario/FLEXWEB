import { prisma } from "@/lib/prisma";

export async function getProspectById(id: string) {
  return prisma.prospect.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, name: true } },
      smsContact: { include: { messages: true } },
      emailLeads: { include: { messages: { orderBy: { step: "asc" } } } },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      followUps: {
        orderBy: { dueAt: "desc" },
        take: 10,
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      appointments: {
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });
}
