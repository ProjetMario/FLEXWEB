"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import {
  pilot,
  prepareDrafts,
  refreshRegistry,
} from "@/lib/outreach/discovery";
import { saveLead, classifyLead, stopLead } from "@/lib/outreach/service";
import { runOutreach, withOutreachLease } from "@/lib/outreach/jobs";
import { mailboxConfigured, verifyMailbox } from "@/lib/outreach/mail";
const base = "/admin/prospection/outreach";
function message(e: unknown) {
  return e instanceof Error && !e.message.includes("prisma")
    ? e.message.slice(0, 220)
    : "Action impossible. Vérifiez les champs et réessayez.";
}
export async function campaignAction(form: FormData) {
  await requireAdmin();
  let error = "";
  let result = "";
  try {
    const action = String(form.get("action"));
    if (action === "run") result = (await runOutreach()).detail;
    else if (action === "verify") {
      await verifyMailbox();
      result = "Connexion IONOS vérifiée. Aucun e-mail envoyé.";
    } else if (action === "pause") {
      const p = await pilot();
      await prisma.outreachCampaign.update({
        where: { id: p.id },
        data: { enabled: false },
      });
      result = "Campagne mise en pause.";
    } else if (action === "enable") {
      if (form.get("confirm") !== "on")
        throw new Error(
          "Confirmez le lancement des messages que vous avez validés.",
        );
      if (!mailboxConfigured() || process.env.OUTREACH_SEND_ENABLED !== "true")
        throw new Error("Raccordement IONOS à terminer avant activation.");
      const mailbox = await prisma.outreachMailbox.findUnique({
        where: { id: "ionos" },
      });
      if (!mailbox?.verifiedAt || mailbox.needsReview || mailbox.lastError)
        throw new Error("Vérifiez la connexion IONOS.");
      const p = await pilot();
      if (
        !(await prisma.outreachLead.count({
          where: { campaignId: p.id, stage: "APPROVED", stoppedAt: null },
        }))
      )
        throw new Error("Validez au moins une fiche et ses trois messages.");
      await prisma.outreachCampaign.update({
        where: { id: p.id },
        data: { enabled: true },
      });
      result = "Campagne activée pour les séquences validées.";
    } else throw new Error("Action inconnue.");
  } catch (e) {
    error = message(e);
  }
  revalidatePath(base);
  redirect(
    `${base}?${error ? "error" : "saved"}=${encodeURIComponent(error || result)}`,
  );
}
export async function leadAction(id: string, form: FormData) {
  const user = await requireAdmin();
  let error = "";
  try {
    const action = String(form.get("action"));
    if (action === "refresh") await refreshRegistry(id);
    else if (action === "save" || action === "approve")
      await saveLead(id, form, user.id);
    else if (action === "stop") await stopLead(id, "CLOSED");
    else if (action === "classify")
      await classifyLead(
        id,
        String(form.get("outcome")),
        String(form.get("date") || ""),
        user.id,
      );
    else if (action === "retry-audit") {
      const result = await withOutreachLease(async () => {
        const lead = await prisma.outreachLead.findUniqueOrThrow({
          where: { id },
          include: { messages: true },
        });
        if (
          lead.approvedAt ||
          lead.stoppedAt ||
          lead.messages.some((m) => m.attemptedAt)
        )
          throw new Error(
            "Le diagnostic est verrouillé après validation ou prise de contact.",
          );
        await prisma.outreachLead.update({
          where: { id },
          data: { auditState: lead.website ? "PENDING" : "MANUAL" },
        });
        if (!lead.website) await prepareDrafts(id, null);
      });
      if (result === null)
        throw new Error(
          "Un traitement est en cours. Réessayez dans un instant.",
        );
    } else throw new Error("Action inconnue.");
  } catch (e) {
    error = message(e);
  }
  revalidatePath(base);
  revalidatePath(`${base}/${id}`);
  revalidatePath("/admin/prospection/prospects");
  redirect(
    `${base}/${id}?${error ? "error=" + encodeURIComponent(error) : "saved=1"}`,
  );
}
