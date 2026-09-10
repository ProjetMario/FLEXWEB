import { prisma } from "../prisma";
import { smtpTransport } from "../outreach/mail";
export async function sendStudioMail() {
  if (
    process.env.STUDIO_EMAILS_ENABLED !== "true" ||
    !process.env.IONOS_MAIL_PASSWORD
  )
    return;
  await prisma.automationMessage.updateMany({
    where: {
      dedupeKey: { startsWith: "studio" },
      status: "PROCESSING",
      lockedAt: { lt: new Date(Date.now() - 900000) },
    },
    data: {
      status: "REVIEW",
      lastError: "Envoi interrompu : vérifier IONOS avant toute reprise.",
    },
  });
  for (let n = 0; n < 5; n++) {
    const message = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "AutomationMessage" WHERE ("dedupeKey" LIKE 'studio:%' OR "dedupeKey" LIKE 'studio-inquiry:%') AND status='PENDING' AND "availableAt"<=NOW() ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      return tx.automationMessage.update({
        where: { id: rows[0].id },
        data: {
          status: "PROCESSING",
          firstAttemptAt: new Date(),
          lockedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    });
    if (!message) return;
    const smtp = smtpTransport();
    try {
      const result = await smtp.sendMail({
        from: "FLEX-WEB <contact@flex-web.fr>",
        to: message.to,
        subject: message.subject,
        text: message.text,
        messageId: `<studio-${message.id}@flex-web.fr>`,
      });
      if (!result.accepted?.length) throw Error("Recipient not accepted");
      await prisma.automationMessage.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId: result.messageId,
          lastError: null,
        },
      });
    } catch {
      await prisma.automationMessage.update({
        where: { id: message.id },
        data: {
          status: "REVIEW",
          lastError:
            "Confirmation SMTP incertaine ; vérifier le journal avant une reprise manuelle.",
        },
      });
    } finally {
      smtp.close();
    }
  }
}
