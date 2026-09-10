import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { generateDraft, queueMessage, event } from "./service";

export async function runAutomation(transport: typeof fetch = fetch) {
  const now = new Date();
  const deadline = Date.now() + 18000;
  const stats = {
    drafts: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    emailEnabled:
      process.env.AUTOMATION_EMAILS_ENABLED === "true" &&
      !!process.env.BREVO_API_KEY,
  };
  const ready = await prisma.salesProject.findMany({
    where: {
      stage: "BRIEF",
      paymentStatus: "PAID",
      briefSubmittedAt: { not: null },
      websiteId: null,
    },
    take: 1,
  });
  for (const project of ready) {
    try {
      if (await generateDraft(project.id)) stats.drafts++;
    } catch {
      stats.failed++;
      await event(
        project.id,
        "DRAFT_ERROR",
        "Le brouillon n’a pas pu être généré. Vérifier la base et le brief.",
      );
    }
  }
  const incomplete = await prisma.salesProject.findMany({
    where: {
      stage: "BRIEF",
      paymentStatus: "PAID",
      briefSubmittedAt: null,
      paidAt: { lt: new Date(now.getTime() - 3 * 86400000) },
    },
    take: 100,
  });
  for (const project of incomplete) {
    if (Date.now() > deadline) break;
    for (const days of [3, 7]) {
      const due = new Date(project.paidAt!.getTime() + days * 86400000);
      if (due > now) continue;
      await queueMessage({
        dedupeKey: `brief:${project.id}:${days}`,
        projectId: project.id,
        expectedStage: "BRIEF",
        to: project.email,
        subject: "Votre site FLEX-WEB attend votre brief",
        text: "Pour démarrer la création de votre site, complétez le brief dans votre espace privé (lien dans notre premier message). Si vous avez besoin d’aide, répondez à ce message.\n\nFLEX-WEB — contact@flex-web.fr",
        availableAt: due,
      });
      // Never send a backlog of both reminders at the same run.
      if (
        days === 3 &&
        now.getTime() - project.paidAt!.getTime() >= 7 * 86400000
      )
        await prisma.automationMessage.updateMany({
          where: { dedupeKey: `brief:${project.id}:3`, status: "PENDING" },
          data: { status: "SKIPPED" },
        });
    }
  }
  await prisma.automationRateLimit.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  if (!stats.emailEnabled) return stats;
  if (
    !process.env.EMAIL_FROM ||
    process.env.EMAIL_FROM.endsWith("@example.com")
  )
    throw new Error("Configure a verified EMAIL_FROM before enabling mail");
  const messages = await prisma.automationMessage.findMany({
    where: {
      NOT: [{dedupeKey:{startsWith:"studio:"}},{dedupeKey:{startsWith:"studio-inquiry:"}}],
      availableAt: { lte: now },
      OR: [
        { status: "PENDING" },
        {
          status: "PROCESSING",
          lockedAt: { lt: new Date(now.getTime() - 300000) },
        },
      ],
    },
    orderBy: { availableAt: "asc" },
    take: 3,
  });
  for (const message of messages) {
    if (Date.now() > deadline) break;
    const lease = await prisma.automationMessage.updateMany({
      where: {
        id: message.id,
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            lockedAt: { lt: new Date(now.getTime() - 300000) },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        attempts: { increment: 1 },
        firstAttemptAt: message.firstAttemptAt || now,
      },
    });
    if (!lease.count) continue;
    if (message.expectedStage && message.projectId) {
      const project = await prisma.salesProject.findUnique({
        where: { id: message.projectId },
      });
      if (
        !project ||
        project.stage !== message.expectedStage ||
        (message.expectedStage === "BRIEF" &&
          (project.briefSubmittedAt || project.paymentStatus !== "PAID"))
      ) {
        await prisma.automationMessage.update({
          where: { id: message.id },
          data: { status: "SKIPPED", lockedAt: null },
        });
        stats.skipped++;
        continue;
      }
    }
    // A crashed or ambiguous send is reviewed manually; it must never be resent blindly.
    // Brevo's duplicate-key window is 30 minutes, so even definite rejections stop after 25.
    if (
      message.status === "PROCESSING" ||
      message.attempts >= 3 ||
      (message.firstAttemptAt &&
        now.getTime() - message.firstAttemptAt.getTime() > 25 * 60000)
    ) {
      await prisma.automationMessage.update({
        where: { id: message.id },
        data: {
          status: "FAILED",
          lockedAt: null,
          lastError:
            "Vérifiez le journal transactionnel Brevo avant tout nouvel envoi.",
        },
      });
      stats.failed++;
      continue;
    }
    let retrySafe = false;
    try {
      const hash = createHash("sha256").update(message.id).digest("hex");
      const key = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      const response = await transport("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
        headers: {
          "api-key": process.env.BREVO_API_KEY!,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: process.env.EMAIL_FROM, name: "FLEX-WEB" },
          to: [{ email: message.to }],
          replyTo: { email: "contact@flex-web.fr", name: "FLEX-WEB" },
          subject: message.subject,
          textContent: message.text,
          headers: { idempotencyKey: key },
          tags: ["flexweb-transactionnel"],
        }),
      });
      retrySafe = response.status === 429;
      const body = (await response.json()) as {
        messageId?: string;
        code?: string;
      };
      const duplicate =
        response.status === 400 && body.code === "duplicate_parameter";
      if (!response.ok && !duplicate)
        throw new Error(
          `Brevo : HTTP ${response.status}. ${retrySafe ? "Nouvelle tentative planifiée." : "Vérification du journal requise."}`,
        );
      if (!body.messageId && !duplicate)
        throw new Error(
          "Confirmation Brevo manquante ; vérifiez le journal avant un nouvel envoi.",
        );
      await prisma.automationMessage.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId: body.messageId || `duplicate:${key}`,
          lockedAt: null,
          lastError: null,
        },
      });
      stats.sent++;
    } catch (error) {
      await prisma.automationMessage.update({
        where: { id: message.id },
        data: {
          status: retrySafe ? "PENDING" : "FAILED",
          lockedAt: null,
          availableAt: new Date(
            Date.now() + Math.min(60, 2 ** message.attempts) * 60000,
          ),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "Envoi à vérifier",
        },
      });
      stats.failed++;
    }
  }
  return stats;
}
