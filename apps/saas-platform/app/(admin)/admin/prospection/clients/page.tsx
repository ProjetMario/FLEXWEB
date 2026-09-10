import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function Clients() {
  await requireAdmin();
  redirect("/admin/prospection/prospects?status=CLIENT_SIGNE");
}
