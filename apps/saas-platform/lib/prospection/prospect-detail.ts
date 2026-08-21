import { prisma } from "@/lib/prisma";

export async function getProspectById(id: string) {
  return prisma.prospect.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, name: true } },
      interactions: {
        orderBy: { createdAt: "desc" },
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
