import nodemailer from "outreach-mailer";
import { ImapFlow } from "imapflow";
import { prisma } from "../prisma";
import { SENDER } from "./core";
import { stopLead } from "./service";
import { simpleParser } from "mailparser";
import { isOpposition } from "../sms/core";

export const mailboxConfigured = () => !!process.env.IONOS_MAIL_PASSWORD;
function password() {
  if (!process.env.IONOS_MAIL_PASSWORD)
    throw new Error(
      "Ajoutez IONOS_MAIL_PASSWORD dans les variables sécurisées Netlify.",
    );
  return process.env.IONOS_MAIL_PASSWORD;
}
export function smtpTransport() {
  return nodemailer.createTransport({
    host: "smtp.ionos.fr",
    port: 465,
    secure: true,
    auth: { user: SENDER, pass: password() },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 7000,
    logger: false,
    debug: false,
    tls: { minVersion: "TLSv1.2" },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
function imapClient() {
  const client = new ImapFlow({
    host: "imap.ionos.fr",
    port: 993,
    secure: true,
    auth: { user: SENDER, pass: password() },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 7000,
    tls: { minVersion: "TLSv1.2" },
  });
  // Never forward protocol errors (which may contain mailbox content) to logs.
  client.on("error", () => {});
  return client;
}
export async function verifyMailbox() {
  const smtp = smtpTransport();
  const imap = imapClient();
  const timer = setTimeout(() => imap.close(), 12000);
  try {
    await smtp.verify();
    await imap.connect();
    await imap.mailboxOpen("INBOX", { readOnly: true });
    await prisma.outreachMailbox.upsert({
      where: { id: "ionos" },
      create: { id: "ionos", verifiedAt: new Date() },
      update: { verifiedAt: new Date(), lastError: null },
    });
  } catch {
    throw new Error(
      "Connexion IONOS impossible. Vérifiez le mot de passe de contact@flex-web.fr et l’accès SMTP/IMAP. Aucun message n’a été envoyé.",
    );
  } finally {
    clearTimeout(timer);
    smtp.close();
    imap.close();
  }
}
export type Incoming = {
  uid: number;
  from: string[];
  references: string[];
  bounceRecipient?: string;
  bounce: boolean;
  subject?: string;
  text?: string;
};
export async function processIncoming(
  incoming: Incoming,
  uidValidity: string,
  loadText?: () => Promise<string>,
) {
  const conditions = [
    { email: { in: incoming.from.map((x) => x.toLowerCase()) } },
    {
      messages: {
        some: {
          messageId: { in: incoming.references },
          status: { in: ["SENT", "REVIEW", "SENDING"] },
        },
      },
    },
  ];
  if (incoming.bounceRecipient)
    conditions.push({
      email: { in: [incoming.bounceRecipient.toLowerCase()] },
    });
  const leads = await prisma.outreachLead.findMany({
    where: {
      OR: conditions,
      messages: { some: { attemptedAt: { not: null } } },
    },
    select: { id: true },
  });
  // Fetch body only after matching an existing prospect; never ingest unrelated mail.
  const body = leads.length
    ? (incoming.text ?? (loadText ? await loadText() : ""))
    : "";
  const firstPart = body
    .split(/\n(?:>|Le .*écrit|On .*wrote|De\s*:|From\s*:)/i)[0]
    .slice(0, 2000);
  for (const lead of leads)
    await stopLead(
      lead.id,
      incoming.bounce
        ? "BOUNCED"
        : isOpposition(firstPart)
          ? "REFUSED"
          : "REPLIED",
      `imap:${uidValidity}:${incoming.uid}:${lead.id}`,
      [incoming.subject, body].filter(Boolean).join("\n\n").slice(0, 10000) ||
        undefined,
    );
  return leads.length;
}
export async function syncMailbox(): Promise<boolean> {
  const state = await prisma.outreachMailbox.findUniqueOrThrow({
    where: { id: "ionos" },
  });
  if (state.needsReview) return false;
  const client = imapClient();
  const timer = setTimeout(() => client.close(), 14000);
  try {
    await client.connect();
    const box = await client.mailboxOpen("INBOX", { readOnly: true });
    const validity = String(box.uidValidity);
    if (state.uidValidity && state.uidValidity !== validity) {
      await prisma.outreachMailbox.update({
        where: { id: "ionos" },
        data: {
          needsReview: true,
          lastError:
            "La boîte a changé d’identifiant IMAP. Faites vérifier la reprise du suivi avant de réactiver les envois.",
        },
      });
      return false;
    }
    if (!state.uidValidity) {
      // First connection precedes every outbound message. Do not inspect old,
      // unrelated mail; a reset after an attempt instead requires reconciliation.
      if (
        await prisma.outreachMessage.count({
          where: { attemptedAt: { not: null } },
        })
      ) {
        await prisma.outreachMailbox.update({
          where: { id: "ionos" },
          data: {
            needsReview: true,
            lastError:
              "Historique de réception manquant : reprise manuelle requise.",
          },
        });
        return false;
      }
      await prisma.outreachMailbox.update({
        where: { id: "ionos" },
        data: {
          uidValidity: validity,
          lastUid: Math.max(0, (box.uidNext || 1) - 1),
          syncedAt: new Date(),
          lastError: null,
        },
      });
      return true;
    }
    const next = box.uidNext || 1;
    if (next <= state.lastUid + 1) {
      await prisma.outreachMailbox.update({
        where: { id: "ionos" },
        data: { syncedAt: new Date(), lastError: null },
      });
      return true;
    }
    // Bounded UID ranges also cope with deleted messages without scanning the
    // complete mailbox. A backlog blocks sending until it has been drained.
    const end = Math.min(state.lastUid + 50, next - 1);
    const messages = await client.fetchAll(
      `${state.lastUid + 1}:${end}`,
      {
        uid: true,
        envelope: true,
        headers: ["in-reply-to", "references", "content-type"],
      },
      { uid: true },
    );
    for (const m of messages) {
      const headers = m.headers?.toString("utf8") || "";
      const from =
        m.envelope?.from
          ?.map((x) => x.address?.toLowerCase() || "")
          .filter(Boolean) || [];
      const bounce =
        from.some((x) => /^(mailer-daemon|postmaster)@/i.test(x)) ||
        /report-type\s*=\s*["']?delivery-status/i.test(headers);
      let bounceRecipient: string | undefined;
      let references: string[] =
        headers.match(/<outreach-[a-f0-9-]+@flex-web\.fr>/g) || [];
      if (bounce) {
        const raw = await client.fetchOne(
          m.uid,
          { source: { maxLength: 32000 } },
          { uid: true },
        );
        const body = (raw && raw.source?.toString("utf8")) || "";
        bounceRecipient = body.match(
          /(?:Final|Original)-Recipient:\s*rfc822;\s*([^\s<>;]+)/i,
        )?.[1];
        references = [
          ...references,
          ...(body.match(/<outreach-[a-f0-9-]+@flex-web\.fr>/g) || []),
        ];
      }
      await processIncoming(
        {
          uid: m.uid,
          from,
          references,
          bounce,
          bounceRecipient,
          subject: m.envelope?.subject,
        },
        validity,
        async () => {
          const raw = await client.fetchOne(
            m.uid,
            { source: { maxLength: 100000 } },
            { uid: true },
          );
          if (!raw || !raw.source)
            return "Contenu indisponible ; ouvrir la boîte IONOS.";
          const parsed = await simpleParser(raw.source, {
            skipHtmlToText: true,
            skipTextToHtml: true,
            skipImageLinks: true,
          });
          return (
            parsed.text?.slice(0, 10000) ||
            "Message HTML ou pièce jointe : consulter IONOS."
          );
        },
      );
    }
    await prisma.outreachMailbox.update({
      where: { id: "ionos" },
      data: { lastUid: end, syncedAt: new Date(), lastError: null },
    });
    return end >= next - 1;
  } catch {
    await prisma.outreachMailbox.update({
      where: { id: "ionos" },
      data: {
        lastError:
          "Lecture IONOS interrompue. Envois suspendus jusqu’à une synchronisation complète.",
      },
    });
    return false;
  } finally {
    clearTimeout(timer);
    client.close();
  }
}
