import { prisma } from "../prisma";
import { queueMessage } from "./service";
import { stages, tokenHash, newToken } from "./core";
import { z } from "zod";

// Only uncommitted requests may be deleted here. Paid projects and any request
// with a Stripe session retain their payment and delivery history.
export async function deleteUnpaidProject(id: string, companyName: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SalesProject" WHERE id = ${id} FOR UPDATE`;
    const project = await tx.salesProject.findUniqueOrThrow({ where: { id } });
    if (companyName !== project.companyName) throw new Error("Recopiez le nom exact de l’entreprise.");
    if (!["NEW", "AWAITING_PAYMENT"].includes(project.stage) || project.paymentStatus !== "UNPAID" || project.paidAt || project.stripeSessionId || project.stripeCustomerId || project.stripeSubscriptionId || project.websiteId || project.organizationId)
      throw new Error("Cette demande possède un engagement ou un historique à conserver.");
    if (await tx.automationMessage.count({ where: { projectId: id, status: "PROCESSING" } }))
      throw new Error("Un message est en cours de traitement. Réessayez plus tard.");
    await tx.automationMessage.deleteMany({ where: { projectId: id } });
    await tx.automationEvent.deleteMany({ where: { projectId: id } });
    await tx.supportTicket.deleteMany({ where: { projectId: id } });
    await tx.salesProject.delete({ where: { id } });
    if (project.prospectId && !await tx.salesProject.count({ where: { prospectId: project.prospectId } })) {
      // Preserve any prospect with a separate commercial history.
      const prospect = await tx.prospect.findUnique({ where: { id: project.prospectId }, include: { interactions: true, followUps: true, _count: { select: { notes: true, appointments: true } } } });
      const offerName = (project.offerSnapshot as { name?: string }).name;
      const onlyAutomaticHistory = prospect?.interactions.every(i => !i.createdById && i.type === "PROSPECT_AJOUTE" && i.note === `Demande web ${id} : ${offerName}`)
        && prospect?.followUps.every(f => !f.createdById && !f.doneAt && f.status === "PENDING" && f.note === `Qualifier la demande ${id} (${offerName}).`);
      if (prospect && prospect.source === project.source && prospect.companyName === project.companyName && prospect.email === project.email && !prospect.internalNotes && !prospect.campaignId && !prospect._count.notes && !prospect._count.appointments && onlyAutomaticHistory)
        await tx.prospect.delete({ where: { id: prospect.id } });
    }
    await tx.automationEvent.create({ data: { type: "UNPAID_REQUEST_DELETED", detail: "Demande non payée supprimée par l’administration ; lien privé et messages supprimés." } });
  });
}

export async function manageProject(
  id: string,
  action: string,
  form: FormData,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SalesProject" WHERE id = ${id} FOR UPDATE`;
    const project = await tx.salesProject.findUniqueOrThrow({ where: { id } });
    if (action === "qualify") {
      if (project.stage !== "NEW")
        throw new Error("Cette demande a déjà été traitée.");
      if (form.get("scopeConfirmed") !== "on")
        throw new Error("Confirmez la vérification du périmètre.");
      await tx.salesProject.update({
        where: { id },
        data: {
          stage: "AWAITING_PAYMENT",
          quoteReference: `FW-${id.slice(0, 8).toUpperCase()}`,
        },
      });
      await tx.automationMessage.upsert({
        where: { dedupeKey: `quote:${id}` },
        update: {},
        create: {
          dedupeKey: `quote:${id}`,
          projectId: id,
          expectedStage: "AWAITING_PAYMENT",
          to: project.email,
          subject: "Votre proposition FLEX-WEB est prête",
          text: "Votre proposition a été validée par FLEX-WEB. Retrouvez les prix, le périmètre et le paiement dans votre espace privé (lien dans notre premier message).\n\nUne question ? contact@flex-web.fr",
        },
      });
    } else if (action === "renew-access") {
      if (
        process.env.AUTOMATION_EMAILS_ENABLED !== "true" ||
        !process.env.BREVO_API_KEY
      )
        throw new Error("Activez les e-mails avant de renouveler un accès.");
      const token = newToken();
      await tx.salesProject.update({
        where: { id },
        data: {
          accessTokenHash: tokenHash(token),
          accessExpiresAt: new Date(Date.now() + 180 * 86400000),
        },
      });
      const base = process.env.MARKETING_URL || "https://flex-web.fr";
      await tx.automationMessage.create({
        data: {
          dedupeKey: `access:${id}:${tokenHash(token)}`,
          projectId: id,
          to: project.email,
          subject: "Votre nouvel accès privé FLEX-WEB",
          text: `Voici votre nouvel accès : ${base}/espace-projet/#cle=${token}\n\nCe lien remplace le précédent. Conservez-le pour suivre votre projet. Ne le partagez pas.`,
        },
      });
    } else if (action === "review") {
      if (
        !["DRAFT_READY", "REVISION_REQUESTED"].includes(project.stage) ||
        project.paymentStatus !== "PAID"
      )
        throw new Error("Le projet n’est pas prêt pour la présentation.");
      if (form.get("qa") !== "on")
        throw new Error("Confirmez votre contrôle qualité.");
      await tx.salesProject.update({
        where: { id },
        data: {
          stage: "CLIENT_REVIEW",
          qaApprovedAt: new Date(),
          clientApprovedAt: null,
        },
      });
      await tx.automationMessage.upsert({
        where: { dedupeKey: `review:${id}:${project.draftVersion}` },
        update: {},
        create: {
          dedupeKey: `review:${id}:${project.draftVersion}`,
          projectId: id,
          expectedStage: "CLIENT_REVIEW",
          to: project.email,
          subject: "Votre site FLEX-WEB attend votre validation",
          text: "Nous avons contrôlé votre brouillon. Vérifiez les contenus et les coordonnées dans votre espace privé, puis validez-les ou demandez des corrections.\n\nFLEX-WEB — contact@flex-web.fr",
        },
      });
    } else if (action === "edit") {
      if (
        !["DRAFT_READY", "REVISION_REQUESTED", "CLIENT_REVIEW"].includes(
          project.stage,
        ) ||
        !project.websiteId
      )
        throw new Error("Le brouillon n’est pas modifiable à cette étape.");
      const sections = await tx.pageSection.findMany({
        where: { page: { websiteId: project.websiteId } },
      });
      for (const section of sections) {
        const config = section.config as Record<string, unknown>;
        const keys =
          section.type === "header"
            ? ["title", "subtitle"]
            : section.type === "text"
              ? ["content"]
              : section.type === "cta"
                ? ["title", "buttonText", "buttonHref"]
                : [];
        for (const key of keys) {
          const value = form.get(`${section.id}:${key}`);
          if (typeof value !== "string" || value.length > 8000)
            throw new Error("Contenu invalide.");
          if (key === "buttonHref" && !/^\/(?!\/)/.test(value))
            throw new Error("Le bouton doit pointer vers une page du site.");
          config[key] = value;
        }
        if (keys.length)
          await tx.pageSection.update({
            where: { id: section.id },
            data: { config: config as Record<string, string> },
          });
      }
      await tx.salesProject.update({
        where: { id },
        data: {
          stage: "DRAFT_READY",
          draftVersion: { increment: 1 },
          qaApprovedAt: null,
          clientApprovedAt: null,
        },
      });
    } else if (action === "publish") {
      if (
        project.stage !== "APPROVED" ||
        !project.clientApprovedAt ||
        !project.qaApprovedAt ||
        project.paymentStatus !== "PAID" ||
        !project.websiteId ||
        !project.organizationId
      )
        throw new Error(
          "Contrôle qualité, paiement et validation client requis.",
        );
      if (form.get("publicationChecks") !== "on")
        throw new Error("Confirmez les contrôles de publication.");
      const domain = await tx.domain.findFirst({
        where: {
          organizationId: project.organizationId,
          isPrimary: true,
          verifiedAt: { not: null },
          sslConfigured: true,
        },
      });
      if (!domain)
        throw new Error(
          "Configurez et vérifiez le domaine principal et son HTTPS avant publication.",
        );
      await tx.website.update({
        where: { id: project.websiteId },
        data: { isPublished: true, primaryDomain: domain.domain },
      });
      await tx.organization.update({
        where: { id: project.organizationId },
        data: { status: "ACTIVE" },
      });
      await tx.page.updateMany({
        where: { websiteId: project.websiteId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      await tx.salesProject.update({
        where: { id },
        data: { stage: "LIVE", publishedAt: new Date() },
      });
      await tx.automationMessage.upsert({
        where: { dedupeKey: `live:${id}` },
        update: {},
        create: {
          dedupeKey: `live:${id}`,
          projectId: id,
          to: project.email,
          subject: "Votre site FLEX-WEB est publié",
          text: `Votre site est accessible sur https://${domain.domain}.\nRetrouvez le suivi et les demandes de modification dans votre espace privé.\n\nFLEX-WEB — contact@flex-web.fr`,
        },
      });
    } else {
      throw new Error("Action inconnue.");
    }
    await tx.automationEvent.create({
      data: {
        projectId: id,
        type: `ADMIN_${action.toUpperCase()}`,
        detail: `${action} effectué depuis l’administration (étape initiale : ${stages[project.stage]}).`,
      },
    });
  });
}
export async function updateTicket(id: string, form: FormData) {
  const data = z
    .object({
      response: z.string().trim().min(1).max(4000),
      minutes: z.coerce.number().int().min(0).max(10000),
      status: z.enum(["OPEN", "DONE"]),
    })
    .parse(Object.fromEntries(form));
  const ticket = await prisma.supportTicket.update({ where: { id }, data });
  const project = await prisma.salesProject.findUniqueOrThrow({
    where: { id: ticket.projectId },
  });
  await queueMessage({
    dedupeKey: `ticket:${id}:${tokenHash(data.response)}`,
    projectId: project.id,
    to: project.email,
    subject: `FLEX-WEB : ${ticket.subject}`,
    text: `${data.response}\n\nVous pouvez répondre via votre espace projet.\nFLEX-WEB — contact@flex-web.fr`,
  });
}
