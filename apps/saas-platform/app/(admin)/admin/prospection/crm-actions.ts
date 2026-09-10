"use server";
import { linkLegacyCrm } from "@/lib/prospection/crm-service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ProspectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import {
  crmLock,
  prepareCrmChannel,
  stopCrmSequences,
} from "@/lib/prospection/crm-service";
import { normalizePhone } from "@/lib/prospection/crm-core";
import {
  mailboxConfigured,
  syncMailbox,
  verifyMailbox,
} from "@/lib/outreach/mail";
import { withOutreachLease } from "@/lib/outreach/jobs";

const qualification = z.object({
  phone: z.string().max(60).transform(normalizePhone),
  email: z.union([z.email(), z.literal("")]),
  website: z.union([
    z.url().refine((v) => /^https?:\/\//.test(v)),
    z.literal(""),
  ]),
  sourceUrl: z.url().refine((v) => v.startsWith("https://")),
  websiteFinding: z.enum(["TO_CHECK", "NOT_FOUND", "HAS_WEBSITE", "CLOSED"]),
  preferredChannel: z.enum(["NONE", "SMS", "EMAIL"]),
  websiteEvidence: z.string().trim().max(2000),
});
export async function crmAction(form: FormData) {
  const user = await requireAdmin();
  const id = z.uuid().parse(form.get("id"));
  let href = `/admin/prospection/prospects/${id}`,
    message = "Modifications enregistrées.",
    error = false;
  try {
    const action = String(form.get("action"));
    if (action === "sms" || action === "email") {
      href = (
        await prepareCrmChannel(
          id,
          action === "sms" ? "SMS" : "EMAIL",
          String(form.get("templateId") || "") || undefined,
        )
      ).href;
      message = "Brouillons préparés, sans envoi.";
    } else
      await prisma.$transaction(async (tx) => {
        await crmLock(tx);
        const p = await tx.prospect.findUniqueOrThrow({
          where: { id },
          include: {
            smsContact: { include: { messages: true } },
            emailLeads: { include: { messages: true } },
          },
        });
        if (action === "qualify") {
          const v = qualification.parse(Object.fromEntries(form));
          if (
            v.websiteFinding !== "TO_CHECK" &&
            (form.get("verified") !== "on" || v.websiteEvidence.length < 20)
          )
            throw Error(
              "Décrivez la recherche et confirmez le contrôle de la fiche.",
            );
          if (v.websiteFinding === "HAS_WEBSITE" && !v.website)
            throw Error("Renseignez le site trouvé.");
          if (v.websiteFinding === "NOT_FOUND" && v.website)
            throw Error(
              "Un site est renseigné : corrigez le résultat de la recherche.",
            );
          if (v.preferredChannel === "SMS" && !/^\+33[67]\d{8}$/.test(v.phone))
            throw Error("Le canal SMS nécessite un mobile professionnel.");
          if (v.preferredChannel === "EMAIL" && !v.email)
            throw Error("Le canal e-mail nécessite un courriel professionnel.");
          const history =
            p.smsContact?.messages.some((m) => m.attemptedAt) ||
            p.emailLeads.some((l) => l.messages.some((m) => m.attemptedAt));
          if (
            history &&
            (v.phone !== p.phone ||
              v.email !== (p.email || "") ||
              v.preferredChannel !== p.preferredChannel)
          )
            throw Error(
              "Les coordonnées et le canal d’un historique envoyé ne peuvent pas être remplacés.",
            );
          const other = await tx.prospect.findFirst({
            where: {
              id: { not: id },
              OR: [
                ...(v.phone ? [{ phone: v.phone }] : []),
                ...(v.email ? [{ email: v.email.toLowerCase() }] : []),
              ],
            },
          });
          if (other)
            throw Error(
              "Ces coordonnées appartiennent déjà à une autre fiche CRM.",
            );
          if (p.smsContact && !/^\+33[67]\d{8}$/.test(v.phone))
            throw Error("Conservez le mobile associé au brouillon SMS.");
          await tx.prospect.update({
            where: { id },
            data: {
              ...v,
              email: v.email.toLowerCase() || null,
              website: v.website || null,
              websiteCheckedAt:
                v.websiteFinding === "TO_CHECK" ? null : new Date(),
              sourceCheckedAt:
                form.get("verified") === "on" ? new Date() : p.sourceCheckedAt,
            },
          });
          if (!history) {
            await tx.outreachMessage.updateMany({
              where: { lead: { prospectId: id }, status: "APPROVED" },
              data: { status: "DRAFT" },
            });
            await tx.outreachLead.updateMany({
              where: { prospectId: id, stoppedAt: null },
              data: {
                email: v.email.toLowerCase() || null,
                phone: v.phone || null,
                website: v.website || null,
                contactSourceUrl: v.sourceUrl,
                approvedAt: null,
                approvedBy: null,
                stage: "NEW",
                ...(form.get("verified") === "on"
                  ? { sourceFetchedAt: new Date() }
                  : {}),
              },
            });
            await tx.smsOutreachMessage.updateMany({
              where: { contact: { prospectId: id }, status: "APPROVED" },
              data: { status: "DRAFT", approvedAt: null, approvedBy: null },
            });
            if (p.smsContact)
              await tx.smsOutreachContact.update({
                where: { id: p.smsContact.id },
                data: {
                  phone: v.phone,
                  sourceUrl: v.sourceUrl,
                  websiteFinding: v.websiteFinding,
                  checkedAt: null,
                  reviewedBy: null,
                },
              });
          }
          if (
            v.websiteFinding === "CLOSED" ||
            v.websiteFinding === "HAS_WEBSITE"
          )
            await stopCrmSequences(tx, id, "QUALIFICATION_CHANGED");
          await tx.prospectInteraction.create({
            data: {
              prospectId: id,
              type: "NOTE",
              createdById: user.id,
              note: `Qualification mise à jour : ${v.websiteFinding}. ${v.websiteEvidence}`,
            },
          });
        } else if (action === "note") {
          const content = z
            .string()
            .trim()
            .min(1)
            .max(5000)
            .parse(form.get("note"));
          await tx.prospectNote.create({
            data: { prospectId: id, content, createdById: user.id },
          });
          await tx.prospectInteraction.create({
            data: {
              prospectId: id,
              type: "NOTE",
              note: content,
              createdById: user.id,
            },
          });
        } else if (action === "stop") {
          await stopCrmSequences(tx, id, "CRM_OPPOSITION", true);
          await tx.prospectInteraction.create({
            data: {
              prospectId: id,
              type: "NOTE",
              note: "Opposition enregistrée : SMS et e-mails arrêtés.",
              createdById: user.id,
            },
          });
        } else if (action === "status") {
          const status = z.enum(ProspectionStatus).parse(form.get("status"));
          if (
            p.doNotContactAt &&
            status !== "PAS_INTERESSE" &&
            status !== "CLIENT_SIGNE"
          )
            throw Error(
              "L’opposition reste active. Cette fiche ne peut pas revenir en prospection.",
            );
          if (
            ![
              "NOUVEAU",
              "A_CONTACTER",
              "SANS_REPONSE",
              "SMS_ENVOYE",
              "A_RELANCER",
            ].includes(status)
          )
            await stopCrmSequences(
              tx,
              id,
              `CRM_${status}`,
              status === "PAS_INTERESSE",
            );
          const amount = z.coerce
            .number()
            .int()
            .min(0)
            .max(10000000)
            .parse(form.get("estimatedValue") || 0);
          const monthly = z.coerce
            .number()
            .int()
            .min(0)
            .max(1000000)
            .parse(form.get("monthlyPrice") || 0);
          await tx.prospect.update({
            where: { id },
            data: {
              status,
              estimatedValue: amount,
              monthlyPrice: monthly,
              signedValue: status === "CLIENT_SIGNE" ? amount : p.signedValue,
            },
          });
          await tx.prospectInteraction.create({
            data: {
              prospectId: id,
              type: "STATUT_MODIFIE",
              oldStatus: p.status,
              newStatus: status,
              createdById: user.id,
              note: "Étape commerciale mise à jour.",
            },
          });
        } else if (action === "appointment") {
          const date=new Date(String(form.get('date')));
          if(!Number.isFinite(date.getTime())||date<new Date())throw Error('Choisissez une date future.');
          if(p.doNotContactAt)throw Error('Cette entreprise ne doit plus être contactée.');
          const membership=await tx.membership.findFirstOrThrow({where:{userId:user.id,role:'SUPER_ADMIN'}});
          const existing=await tx.appointment.findFirst({where:{prospectId:id,date}});
          if(!existing){
            await tx.appointment.create({data:{organizationId:membership.organizationId,prospectId:id,name:p.companyName,email:p.email||'',phone:p.phone||null,date,notes:z.string().max(2000).parse(form.get('note')||'')}});
            await tx.prospectInteraction.create({data:{prospectId:id,type:'RDV',createdById:user.id,note:`Rendez-vous prévu le ${date.toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}.`}});
          }
          await stopCrmSequences(tx,id,'CRM_MEETING');
          await tx.prospect.update({where:{id},data:{status:'RDV_PLANIFIE'}});
        } else if (action === "follow-up") {
          const dueAt = new Date(String(form.get("date")));
          if (!Number.isFinite(dueAt.getTime()) || dueAt < new Date())
            throw Error("Choisissez une date future.");
          if (p.doNotContactAt)
            throw Error("Cette entreprise ne doit plus être contactée.");
          await tx.followUp.create({
            data: {
              prospectId: id,
              dueAt,
              note: z
                .string()
                .max(2000)
                .parse(form.get("note") || ""),
              createdById: user.id,
            },
          });
          const first = await tx.followUp.findFirst({
            where: { prospectId: id, status: "PENDING" },
            orderBy: { dueAt: "asc" },
          });
          await tx.prospect.update({
            where: { id },
            data: { nextFollowUpAt: first?.dueAt || null },
          });
        } else if (action === "done") {
          const followUpId = z.uuid().parse(form.get("followUpId"));
          await tx.followUp.updateMany({
            where: { id: followUpId, prospectId: id, status: "PENDING" },
            data: { status: "DONE", doneAt: new Date() },
          });
          const first = await tx.followUp.findFirst({
            where: { prospectId: id, status: "PENDING" },
            orderBy: { dueAt: "asc" },
          });
          await tx.prospect.update({
            where: { id },
            data: { nextFollowUpAt: first?.dueAt || null },
          });
        } else throw Error("Action inconnue.");
      });
  } catch (e) {
    error = true;
    message =
      e instanceof z.ZodError
        ? "Vérifiez les champs du formulaire."
        : e instanceof Error && !e.message.includes("prisma")
          ? e.message.slice(0, 220)
          : "Modification impossible. Vérifiez les coordonnées et réessayez.";
  }
  revalidatePath("/admin/prospection", "layout");
  redirect(
    `${href}${href.includes("?") ? "&" : "?"}${error ? "error" : "saved"}=${encodeURIComponent(message)}`,
  );
}

export async function crmMailAction(form: FormData) {
  await requireAdmin();
  let message = "",
    error = false;
  try {
    const action = String(form.get("action"));
    if (action === "link-existing") {
      const result = await linkLegacyCrm();
      message = `${result.linked} anciennes fiches reliées au CRM ; ${result.remaining} restantes, dont ${result.conflicts.length} conflits à vérifier.`;
    } else if (action === "verify") {
      await verifyMailbox();
      message = "Connexion IONOS vérifiée.";
    } else if (action === "sync") {
      const synced = await withOutreachLease(syncMailbox);
      message = synced
        ? "Réponses synchronisées."
        : "Synchronisation en attente ou connexion à vérifier.";
    } else if (action === "pause-all") {
      await prisma.outreachCampaign.updateMany({ data: { enabled: false } });
      message = "Tous les envois e-mail sont en pause.";
    } else if (action === "enable" || action === "pause") {
      const campaignId = z.uuid().parse(form.get("campaignId"));
      if (action === "enable") {
        if (
          form.get("confirm") !== "on" ||
          !mailboxConfigured() ||
          process.env.OUTREACH_SEND_ENABLED !== "true"
        )
          throw Error("Terminez la connexion IONOS et confirmez le lancement.");
        const box = await prisma.outreachMailbox.findUnique({
          where: { id: "ionos" },
        });
        if (!box?.verifiedAt || box.needsReview || box.lastError)
          throw Error("Vérifiez la réception IONOS.");
        if (
          !(await prisma.outreachLead.count({
            where: { campaignId, approvedAt: { not: null }, stoppedAt: null },
          }))
        )
          throw Error("Validez au moins une séquence avant activation.");
      }
      await prisma.outreachCampaign.update({
        where: { id: campaignId },
        data: { enabled: action === "enable" },
      });
      message =
        action === "enable"
          ? "Campagne activée pour les messages validés."
          : "Campagne en pause.";
    } else throw Error("Action inconnue.");
  } catch (e) {
    error = true;
    message =
      e instanceof Error && !e.message.includes("prisma")
        ? e.message.slice(0, 220)
        : "Action impossible.";
  }
  revalidatePath("/admin/prospection", "layout");
  redirect(
    `/admin/prospection/inbox?${error ? "error" : "saved"}=${encodeURIComponent(message)}`,
  );
}
