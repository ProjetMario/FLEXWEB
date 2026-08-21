import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import { createProspect } from "@/app/(admin)/admin/prospection/prospects/actions";
import { ProspectForm } from "@/components/prospection/ProspectForm";

export default async function NewProspectPage() {
  await requireAdmin();
  const campaigns = await prisma.smsCampaign.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <ProspectForm action={createProspect} campaigns={campaigns} />;
}
