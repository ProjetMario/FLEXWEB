import { prisma } from "../prisma";
import { Prisma, type SalesProject } from "@prisma/client";
import {
  briefSchema,
  draftPages,
  HttpError,
  intakeSchema,
  offerForIntake,
  requiresManualQuote,
  tokenHash,
} from "./core";

const day = 86_400_000;
export const marketingUrl = () =>
  (process.env.MARKETING_URL || "https://flex-web.fr").replace(/\/$/, "");
export async function event(projectId: string, type: string, detail: string) {
  await prisma.automationEvent.create({ data: { projectId, type, detail } });
}
export async function queueMessage(data: {
  dedupeKey: string;
  projectId?: string;
  expectedStage?: string;
  to: string;
  subject: string;
  text: string;
  availableAt?: Date;
}) {
  return prisma.automationMessage.upsert({
    where: { dedupeKey: data.dedupeKey },
    create: data,
    update: {},
  });
}
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds = 3600,
) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const row = await prisma.automationRateLimit.upsert({
    where: { key: `${key}:${bucket}` },
    update: { count: { increment: 1 } },
    create: {
      key: `${key}:${bucket}`,
      expiresAt: new Date((bucket + 1) * windowSeconds * 1000),
    },
  });
  if (row.count > limit)
    throw new HttpError(429, "Trop de demandes. Réessayez dans un moment.");
}
export async function getProject(token: string | null) {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(
      401,
      "Ouvrez votre lien privé pour retrouver votre projet.",
    );
  const project = await prisma.salesProject.findUnique({
    where: { accessTokenHash: tokenHash(token) },
  });
  if (!project || project.accessExpiresAt < new Date())
    throw new HttpError(
      401,
      "Lien privé invalide ou expiré. Contactez contact@flex-web.fr.",
    );
  return project;
}
export async function createIntake(input: unknown) {
  const data = intakeSchema.parse(input);
  const offer = offerForIntake(data);
  const hash = tokenHash(data.accessToken);
  const existing = await prisma.salesProject.findUnique({
    where: { requestKey: data.requestKey },
  });
  if (existing) {
    if (existing.accessTokenHash !== hash)
      throw new HttpError(409, "Cette demande existe déjà.");
    return existing;
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const prospect = await tx.prospect.upsert({
        where: {
          phone_companyName: {
            phone: data.phone,
            companyName: data.companyName,
          },
        },
        update: {},
        create: {
          companyName: data.companyName,
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          city: data.city,
          businessType: data.businessType,
          status: "INTERESSE",
          source: data.source,
          setupFee: offer.setupCents / 100,
          monthlyPrice: offer.monthlyCents / 100,
        },
      });
      const project = await tx.salesProject.create({
        data: {
          requestKey: data.requestKey,
          accessTokenHash: hash,
          accessExpiresAt: new Date(Date.now() + 180 * day),
          companyName: data.companyName,
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          city: data.city,
          businessType: data.businessType,
          message: data.message,
          timeline: data.timeline,
          source: data.source,
          planId: offer.id,
          monthlyCents: offer.monthlyCents,
          setupCents: offer.setupCents,
          offerSnapshot: offer,
          prospectId: prospect.id,
        },
      });
      await tx.followUp.create({
        data: {
          prospectId: prospect.id,
          dueAt: new Date(Date.now() + day),
          note: `Qualifier la demande ${project.id} (${offer.name}).`,
        },
      });
      await tx.prospectInteraction.create({
        data: {
          prospectId: prospect.id,
          type: "PROSPECT_AJOUTE",
          note: `Demande web ${project.id} : ${offer.name}`,
        },
      });
      await tx.automationEvent.create({
        data: {
          projectId: project.id,
          type: "INTAKE",
          detail:
            "Demande professionnelle reçue ; information relative aux données acceptée.",
        },
      });
      await tx.automationMessage.create({
        data: {
          dedupeKey: `welcome:${project.id}`,
          projectId: project.id,
          to: project.email,
          subject: "Votre projet FLEX-WEB : demande reçue",
          text: `Bonjour ${project.contactName},\n\nNous avons reçu votre demande pour ${project.companyName}. Nous allons vérifier son périmètre avant de vous proposer un paiement.\n\nVotre espace privé : ${marketingUrl()}/espace-projet/#cle=${data.accessToken}\n\nConservez ce lien confidentiel.\nFLEX-WEB — contact@flex-web.fr`,
        },
      });
      return project;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.salesProject.findUnique({
        where: { requestKey: data.requestKey },
      });
      if (duplicate?.accessTokenHash === hash) return duplicate;
      throw new HttpError(409, "Une demande identique est déjà en cours.");
    }
    throw error;
  }
}
export async function submitBrief(project: SalesProject, input: unknown) {
  const brief = briefSchema.parse(input);
  const updated = await prisma.salesProject.updateMany({
    where: {
      id: project.id,
      stage: "BRIEF",
      paymentStatus: "PAID",
      briefSubmittedAt: null,
    },
    data: { brief, briefSubmittedAt: new Date() },
  });
  if (!updated.count)
    throw new HttpError(
      409,
      "Le brief ne peut plus être modifié à cette étape.",
    );
  await event(
    project.id,
    "BRIEF_RECEIVED",
    "Brief complet reçu. Génération du brouillon en attente.",
  );
  // Durable: if generation fails here, the scheduled worker retries it from the stored brief.
  try {
    await generateDraft(project.id);
  } catch {
    await event(
      project.id,
      "DRAFT_RETRY",
      "Génération à reprendre par le traitement planifié.",
    );
  }
}
export async function generateDraft(projectId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SalesProject" WHERE id = ${projectId} FOR UPDATE`;
      const project = await tx.salesProject.findUniqueOrThrow({
        where: { id: projectId },
      });
      if (
        project.paymentStatus !== "PAID" ||
        !project.brief ||
        project.websiteId ||
        project.stage !== "BRIEF"
      )
        return false;
      const brief = briefSchema.parse(project.brief);
      const org = await tx.organization.create({
        data: {
          name: project.companyName,
          slug: `projet-${project.id}`,
          businessType: project.businessType,
          status: "TRIAL",
        },
      });
      const staff = await tx.membership.findMany({
        where: { role: "SUPER_ADMIN" },
        select: { userId: true },
        distinct: ["userId"],
      });
      if (staff.length)
        await tx.membership.createMany({
          data: staff.map((m) => ({
            organizationId: org.id,
            userId: m.userId,
            role: "SUPER_ADMIN" as const,
          })),
        });
      const website = await tx.website.create({
        data: {
          organizationId: org.id,
          name: project.companyName,
          isPublished: false,
        },
      });
      await tx.form.create({
        data: {
          organizationId: org.id,
          name: "Demande de devis",
          fields: ["name", "email", "phone", "city", "service", "message"],
          notifyEmails: [brief.contactEmail],
        },
      });
      if (project.monthlyCents)
        await tx.subscription.create({
          data: {
            organizationId: org.id,
            plan: project.planId,
            status: "ACTIVE",
            paymentProvider: "stripe",
            externalId: project.stripeSubscriptionId,
          },
        });
      await tx.websiteSettings.create({
        data: {
          organizationId: org.id,
          websiteId: website.id,
          brandColor: brief.color,
          contactEmail: brief.contactEmail,
          contactPhone: brief.phone,
        },
      });
      for (const page of draftPages(project.companyName, brief)) {
        const createdPage = await tx.page.create({
          data: {
            organizationId: org.id,
            websiteId: website.id,
            title: page.title,
            slug: page.slug,
            isHomepage: page.isHomepage,
            status: "DRAFT",
            metaTitle: `${page.title} — ${project.companyName}`,
            metaDescription: brief.description.slice(0, 155),
            sections: { create: page.sections },
          },
        });
        if (page.slug === "contact")
          await tx.pageSection.create({
            data: {
              pageId: createdPage.id,
              type: "inquiry",
              config: { services: brief.services },
              order: 2,
            },
          });
        await tx.navigationItem.create({
          data: {
            organizationId: org.id,
            websiteId: website.id,
            label: page.title,
            href: page.isHomepage ? "/" : `/${page.slug}`,
            order: draftPages(project.companyName, brief).findIndex(
              (p) => p.slug === page.slug,
            ),
          },
        });
      }
      await tx.salesProject.update({
        where: { id: project.id },
        data: {
          organizationId: org.id,
          websiteId: website.id,
          stage: "DRAFT_READY",
          draftVersion: 1,
        },
      });
      await tx.automationEvent.create({
        data: {
          projectId,
          type: "DRAFT_READY",
          detail:
            "5 pages créées en brouillon à partir des contenus fournis. Contrôle humain requis.",
        },
      });
      return true;
    },
    { timeout: 15000 },
  );
}
export async function publicProject(project: SalesProject) {
  const previewVisible = [
    "CLIENT_REVIEW",
    "REVISION_REQUESTED",
    "APPROVED",
    "LIVE",
  ].includes(project.stage);
  const pages =
    previewVisible && project.websiteId
      ? await prisma.page.findMany({
          where: { websiteId: project.websiteId },
          select: {
            title: true,
            sections: {
              select: { type: true, config: true },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const tickets = await prisma.supportTicket.findMany({
    where: { projectId: project.id },
    select: {
      id: true,
      subject: true,
      status: true,
      response: true,
      minutes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const inquiries = project.organizationId
    ? await prisma.lead.findMany({
        where: {
          organizationId: project.organizationId,
          source: "site-client",
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];
  return {
    id: project.id,
    companyName: project.companyName,
    planId: project.planId,
    stage: project.stage,
    paymentStatus: project.paymentStatus,
    monthlyCents: project.monthlyCents,
    setupCents: project.setupCents,
    quoteReference: project.quoteReference,
    briefSubmitted: !!project.briefSubmittedAt,
    termsAcceptedAt: project.termsAcceptedAt,
    checkoutAvailable:
      !requiresManualQuote(project.offerSnapshot) &&
      !!process.env.STRIPE_SECRET_KEY &&
      !!process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.AUTOMATION_PAYMENTS_ENABLED === "true",
    billingAvailable:
      !!project.paidAt &&
      !!project.stripeCustomerId &&
      !!process.env.STRIPE_BILLING_PORTAL_CONFIGURATION &&
      process.env.AUTOMATION_PAYMENTS_ENABLED === "true",
    createdAt: project.createdAt,
    pages,
    tickets,
    inquiries,
    offer: project.offerSnapshot,
  };
}
