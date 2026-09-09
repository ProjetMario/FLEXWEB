"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
import { manageProject, updateTicket, deleteUnpaidProject } from "@/lib/automation/admin";
import { runAutomation } from "@/lib/automation/jobs";

export async function projectAction(id: string, form: FormData) {
  await requireAdmin();
  let error = "";
  try {
    await manageProject(id, String(form.get("action")), form);
  } catch (e) {
    error = e instanceof Error ? e.message : "Action impossible";
  }
  revalidatePath("/admin/prospection/automation");
  revalidatePath(`/admin/prospection/automation/${id}`);
  redirect(
    `/admin/prospection/automation/${id}${error ? `?error=${encodeURIComponent(error.slice(0, 250))}` : "?saved=1"}`,
  );
}
export async function deleteRequest(id: string, form: FormData) {
  await requireAdmin();
  let error = "";
  try { await deleteUnpaidProject(id, String(form.get("confirmCompany") || "")); }
  catch (e) { error = e instanceof Error ? e.message : "Suppression impossible"; }
  if (error) redirect(`/admin/prospection/automation/${id}?error=${encodeURIComponent(error)}`);
  revalidatePath("/admin/prospection/automation");
  revalidatePath("/admin/prospection/prospects");
  redirect("/admin/prospection/automation");
}
export async function ticketAction(
  projectId: string,
  ticketId: string,
  form: FormData,
) {
  await requireAdmin();
  const { prisma } = await import("@/lib/prisma");
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, projectId },
  });
  if (!ticket) throw new Error("Ticket introuvable");
  await updateTicket(ticketId, form);
  revalidatePath(`/admin/prospection/automation/${projectId}`);
}
export async function runWorker() {
  await requireAdmin();
  await runAutomation();
  revalidatePath("/admin/prospection/automation");
}
