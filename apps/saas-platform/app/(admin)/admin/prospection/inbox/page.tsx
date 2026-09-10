import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { mailboxConfigured } from "@/lib/outreach/mail";
import { smsStatuses } from "@/lib/sms/core";
import { crmMailAction } from "../crm-actions";
const card = "rounded-xl border bg-white p-5 space-y-3",
  button = "rounded-lg border px-3 py-2 text-sm hover:bg-slate-50";
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const view = ["responses", "pending", "review"].includes(query.view || "")
    ? query.view
    : "responses";
  const [sms, box, campaigns, replies, mailQueue, smsQueue, sentMail, sentSms] =
    await Promise.all([
      prisma.smsAutomationSettings.findUnique({ where: { id: "onoff" } }),
      prisma.outreachMailbox.findUnique({ where: { id: "ionos" } }),
      prisma.outreachCampaign.findMany({
        include: { _count: { select: { leads: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.prospectInteraction.findMany({
        where: { type: "REPONSE_RECUE" },
        include: {
          prospect: {
            select: { id: true, companyName: true, doNotContactAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.outreachMessage.findMany({
        where: {
          status: {
            in:
              view === "review" ? ["REVIEW", "SENDING"] : ["DRAFT", "APPROVED"],
          },
        },
        include: { lead: { select: { id: true, companyName: true } } },
        orderBy: { id: "desc" },
        take: 50,
      }),
      prisma.smsOutreachMessage.findMany({
        where: {
          status: {
            in:
              view === "review"
                ? ["REVIEW", "DISPATCHED"]
                : ["DRAFT", "APPROVED"],
          },
        },
        include: { contact: { select: { id: true, companyName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.outreachMessage.count({ where: { status: "SENT" } }),
      prisma.smsOutreachMessage.count({ where: { status: "SENT" } }),
    ]);
  const emailStatuses: Record<string, string> = {
    DRAFT: "Brouillon",
    APPROVED: "Validé",
    REVIEW: "Envoi à vérifier",
    SENDING: "En cours de traitement",
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">SMS et e-mails</h1>
        <p className="mt-2 text-slate-600">
          {sentSms} SMS confirmés · {sentMail} e-mails acceptés par IONOS. Les
          échanges sont reliés aux fiches CRM.
        </p>
      </header>
      {query.error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {query.error}
        </p>
      )}
      {query.saved && (
        <p role="status" className="rounded bg-green-50 p-3 text-green-800">
          {query.saved}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">Onoff · SMS</h2>
          <p>{sms?.enabled ? "File active" : "Envois en pause"}</p>
          <p className="text-sm text-slate-600">
            Zapier : {sms?.dispatchVerifiedAt ? "testé" : "à terminer"} ·
            Réception Onoff : {sms?.webhookVerifiedAt ? "testée" : "à terminer"}
          </p>
          <Link
            className="text-blue-700 underline text-sm"
            href="/admin/prospection/sms"
          >
            Messages SMS et raccordement
          </Link>
        </section>
        <section className={card}>
          <h2 className="font-semibold">IONOS · contact@flex-web.fr</h2>
          <p>
            {box?.verifiedAt
              ? "Connexion vérifiée"
              : mailboxConfigured()
                ? "Connexion à tester"
                : "Connexion à configurer"}
          </p>
          <p className="text-sm text-slate-600">
            Synchronisation :{" "}
            {box?.syncedAt?.toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
            }) || "Jamais"}
          </p>
          {box?.lastError && (
            <p className="text-sm text-red-700">{box.lastError}</p>
          )}
          <form action={crmMailAction} className="flex flex-wrap gap-2">
            <button className={button} name="action" value="verify">
              Tester IONOS
            </button>
            <button className={button} name="action" value="sync">
              Actualiser les réponses
            </button>
            <button className={button} name="action" value="pause-all">
              Suspendre les e-mails
            </button>
          </form>
        </section>
      </div>
      <form action={crmMailAction}>
        <button className={button} name="action" value="link-existing">Relier les anciennes fiches e-mail au CRM</button>
      </form>
      <nav className="flex flex-wrap gap-2" aria-label="Messages">
        {[
          ["responses", "Réponses et oppositions"],
          ["pending", "Brouillons et file"],
          ["review", "Envois à vérifier"],
        ].map(([key, label]) => (
          <Link
            key={key}
            className={button}
            aria-current={view === key ? "page" : undefined}
            href={`?view=${key}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "responses" ? (
        <section className={card}>
          <h2 className="font-semibold">50 dernières réponses</h2>
          {!replies.length && (
            <p className="text-slate-500">
              Aucune réponse de prospection reçue pour le moment.
            </p>
          )}
          {replies.map((r) => (
            <article className="border-t pt-4" key={r.id}>
              <Link
                className="font-medium text-blue-700 underline"
                href={`/admin/prospection/prospects/${r.prospectId}`}
              >
                {r.prospect.companyName}
              </Link>
              <p className="text-xs text-slate-500">
                {r.createdAt.toLocaleString("fr-FR", {
                  timeZone: "Europe/Paris",
                })}{" "}
                ·{" "}
                {r.prospect.doNotContactAt
                  ? "Ne plus contacter"
                  : "Ouvrir la fiche pour traiter la réponse"}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {r.note}
              </p>
            </article>
          ))}
          <a
            href="https://mail.ionos.fr/"
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-blue-700 underline"
          >
            Ouvrir IONOS pour répondre ou lire les pièces jointes
          </a>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={card}>
            <h2 className="font-semibold">SMS · 50 derniers résultats</h2>
            {!smsQueue.length && <p>Aucun message dans cette vue.</p>}
            {smsQueue.map((m) => (
              <article className="border-t pt-3" key={m.id}>
                <Link
                  className="font-medium text-blue-700 underline"
                  href={`/admin/prospection/sms?id=${m.contact.id}`}
                >
                  {m.contact.companyName}
                </Link>
                <p className="text-xs text-slate-500">
                  {smsStatuses[m.status] || m.status}
                </p>
                <p className="mt-1 text-sm">{m.body}</p>
              </article>
            ))}
          </section>
          <section className={card}>
            <h2 className="font-semibold">E-mails · 50 derniers résultats</h2>
            {!mailQueue.length && <p>Aucun message dans cette vue.</p>}
            {mailQueue.map((m) => (
              <article className="border-t pt-3" key={m.id}>
                <Link
                  className="font-medium text-blue-700 underline"
                  href={`/admin/prospection/outreach/${m.lead.id}`}
                >
                  {m.lead.companyName}
                </Link>
                <p className="text-xs text-slate-500">
                  {emailStatuses[m.status] || m.status} · Message {m.step + 1}
                </p>
                <p className="mt-1 text-sm">{m.subject}</p>
                {m.lastError && (
                  <p className="text-sm text-red-700">{m.lastError}</p>
                )}
              </article>
            ))}
          </section>
        </div>
      )}
      <section className={card}>
        <h2 className="font-semibold">Campagnes e-mail</h2>
        <p className="text-sm text-slate-600">
          Premier contact, suivis à J+4 et J+10. Une réponse ou une opposition
          arrête les relances. Plafond de 10 e-mails par jour pour la boîte, en
          journée.
        </p>
        {!campaigns.length && (
          <p>
            Préparez un premier e-mail depuis une fiche CRM pour créer la
            campagne.
          </p>
        )}
        {campaigns.map((c) => (
          <form
            key={c.id}
            action={crmMailAction}
            className="border-t pt-4 space-y-2"
          >
            <input type="hidden" name="campaignId" value={c.id} />
            <p className="font-medium">
              {c.name} · {c._count.leads} fiches ·{" "}
              {c.enabled ? "Active" : "En pause"}
            </p>
            {!c.enabled && (
              <label className="flex gap-2 text-sm">
                <input name="confirm" type="checkbox" required />
                Lancer les messages validés de cette campagne.
              </label>
            )}
            <button
              className={button}
              name="action"
              value={c.enabled ? "pause" : "enable"}
            >
              {c.enabled ? "Mettre en pause" : "Activer la campagne"}
            </button>
          </form>
        ))}
      </section>
    </div>
  );
}
