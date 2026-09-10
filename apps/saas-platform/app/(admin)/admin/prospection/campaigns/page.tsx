import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function Campaigns() {
  await requireAdmin();
  redirect("/admin/prospection/inbox?view=pending");
}
