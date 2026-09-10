import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function Quotes() {
  await requireAdmin();
  redirect("/admin/prospection/prospects?statuses=DEVIS_ENVOYE,NEGOCIATION");
}
