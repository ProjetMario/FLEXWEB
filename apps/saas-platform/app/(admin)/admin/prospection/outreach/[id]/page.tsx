import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { stages, type Audit, signedText } from "@/lib/outreach/core";
import { leadAction } from "../actions";
import AppointmentDate from "../AppointmentDate";
export const dynamic = "force-dynamic";
const card = "rounded-xl border bg-white p-5 text-slate-900";
const field =
  "mt-1 block w-full rounded-lg border bg-white p-2 text-sm text-slate-900";
const button =
  "rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50";
export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [lead, query] = await Promise.all([
    prisma.outreachLead.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { step: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    }),
    searchParams,
  ]);
  if (!lead) notFound();
  const audit = lead.audit as Audit | null;
  const locked =
    !!lead.firstSentAt ||
    !!lead.stoppedAt ||
    lead.messages.some((m) => m.attemptedAt);
  const action = leadAction.bind(null, id);
  return (
    <div className="space-y-6">
      <Link
        href="/admin/prospection/outreach"
        className="text-sm text-blue-700 underline"
      >
        ← Prospection locale
      </Link>
      <div>
        <h1 className="text-2xl font-semibold break-words">
          {lead.companyName}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {lead.city} · {lead.postalCode} · {stages[lead.stage] || lead.stage}
        </p>
      </div>
      {query.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {query.error}
        </p>
      )}
      {query.saved && (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">
          Modifications enregistrées.
        </p>
      )}
      <section className={card}>
        <h2 className="font-semibold">Sources et diagnostic</h2>
        {!locked && (
          <form action={action} className="mt-3">
            <button className={button} name="action" value="refresh">
              Actualiser la fiche officielle
            </button>
          </form>
        )}
        <p className="mt-2 text-sm">
          <a
            className="text-blue-700 underline"
            href={lead.registryUrl}
            target="_blank"
            rel="noreferrer"
          >
            Annuaire officiel · SIREN {lead.siren}
          </a>{" "}
          · importé le {lead.sourceFetchedAt.toLocaleDateString("fr-FR")}
        </p>
        {lead.contactSourceUrl && (
          <a
            className="mt-2 inline-block text-sm text-blue-700 underline"
            href={lead.contactSourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source des coordonnées
          </a>
        )}
        {lead.website && (
          <p className="mt-2 text-sm break-all">
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              Ouvrir le site pour le vérifier
            </a>
          </p>
        )}
        <p className="mt-3 text-sm text-slate-600">
          {audit?.note ||
            "Le diagnostic sera préparé dès qu’un site public sera renseigné. Vérifie l’identité de l’entreprise et son parcours de demande de devis."}
        </p>
        {!!audit?.findings.length && (
          <ul className="mt-4 space-y-3">
            {audit.findings.map((f) => (
              <li key={f.label}>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="mt-1 break-words text-xs text-slate-500">
                  {f.evidence}
                </p>
              </li>
            ))}
          </ul>
        )}
        {audit?.checkedAt && (
          <p className="mt-3 text-xs text-slate-500">
            Contrôle du{" "}
            {new Date(audit.checkedAt).toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
            })}
          </p>
        )}
        {!locked && !lead.approvedAt && (
          <form action={action} className="mt-3">
            <button className={button} name="action" value="retry-audit">
              Reprogrammer le diagnostic
            </button>
          </form>
        )}
      </section>
      <form action={action} className={`${card} space-y-5`}>
        <h2 className="font-semibold">Destinataire et trois messages</h2>
        <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            E-mail professionnel
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              defaultValue={lead.email || ""}
              className={field}
            />
          </label>
          <label className="text-sm">
            Site web
            <input
              type="url"
              name="website"
              defaultValue={lead.website || ""}
              className={field}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Lien public justifiant les coordonnées
            <input
              type="url"
              name="source"
              required
              defaultValue={lead.contactSourceUrl || ""}
              className={field}
            />
          </label>
        </fieldset>
        {lead.messages.map((m) => (
          <fieldset
            key={m.id}
            disabled={locked}
            className="space-y-2 rounded-lg border p-4"
          >
            <legend className="px-2 text-sm font-semibold">
              {m.step === 0
                ? "Premier message"
                : `Relance J+${m.step === 1 ? 4 : 10}`}{" "}
              ·{" "}
              {(
                {
                  DRAFT: "Brouillon",
                  APPROVED: "Validé",
                  SENT: "Envoyé",
                  REVIEW: "À vérifier",
                  SKIPPED: "Arrêté",
                  SENDING: "En cours",
                } as Record<string, string>
              )[m.status] || m.status}
            </legend>
            <label className="block text-sm">
              Objet
              <input
                name={`subject${m.step}`}
                required
                maxLength={180}
                defaultValue={m.subject}
                className={field}
              />
            </label>
            <label className="block text-sm">
              Message
              <textarea
                name={`text${m.step}`}
                required
                maxLength={5000}
                rows={9}
                defaultValue={m.text}
                className={field}
              />
            </label>
            {m.lastError && (
              <p className="text-sm text-amber-800">{m.lastError}</p>
            )}
          </fieldset>
        ))}
        {!lead.messages.length && (
          <p className="text-sm text-slate-500">
            Les brouillons apparaîtront après la recherche de coordonnées et le
            diagnostic.
          </p>
        )}
        <details className="rounded-lg bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm">
            Signature et désinscription ajoutées à chaque message
          </summary>
          <p className="mt-3 whitespace-pre-line break-all text-xs text-slate-600">
            {signedText(lead, "").trim()}
          </p>
        </details>
        {!locked && lead.messages.length === 3 && (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input name="relevance" type="checkbox" className="mt-1" />
              J’ai vérifié l’adresse professionnelle, la source et la pertinence
              de ce service pour cette entreprise.
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input name="diagnostic" type="checkbox" className="mt-1" />
              J’ai vérifié le site et les observations utilisées, puis relu et
              validé les trois messages.
            </label>
            <div className="flex flex-wrap gap-3">
              <button name="action" value="save" className={button}>
                Enregistrer les brouillons
              </button>
              <button
                name="action"
                value="approve"
                className={`${button} bg-slate-900 text-white hover:bg-slate-800`}
              >
                Valider la séquence
              </button>
            </div>
            <p className="text-xs text-slate-500">
              La validation prépare la séquence. L’envoi nécessite aussi une
              connexion IONOS vérifiée et l’activation de la campagne. Modifier
              un brouillon retire sa validation.
            </p>
          </>
        )}
      </form>
      <section className={card}>
        <h2 className="font-semibold">Suite de la conversation</h2>
        <p className="mt-2 text-sm text-slate-500">
          Lis la réponse dans IONOS, puis renseigne son issue. Cette
          qualification suspend les relances et ajoute les contacts intéressés
          au suivi commercial.
        </p>
        <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Issue
            <select name="outcome" className={field}>
              <option value="INTERESTED">Intéressé</option>
              <option value="MEETING">Rendez-vous confirmé</option>
              <option value="WON">Client signé</option>
              <option value="REFUSED">Refus · ne plus contacter</option>
              <option value="CLOSED">Classer sans suite</option>
            </select>
          </label>
          <AppointmentDate />
          <button className={button} name="action" value="classify">
            Enregistrer l’issue
          </button>
        </form>
        {lead.prospectId && (
          <Link
            href={`/admin/prospection/prospects/${lead.prospectId}`}
            className="mt-4 inline-block text-sm text-blue-700 underline"
          >
            Ouvrir la fiche commerciale
          </Link>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Une signature déclarée ici ne déclenche aucun paiement. Le client
          démarre son projet sur{" "}
          <a
            className="underline"
            href="https://flex-web.fr/demarrer/"
            target="_blank"
            rel="noreferrer"
          >
            flex-web.fr/demarrer
          </a>
          .
        </p>
        {!lead.stoppedAt && (
          <form action={action} className="mt-4">
            <button
              name="action"
              value="stop"
              className={`${button} text-red-700`}
            >
              Arrêter cette séquence
            </button>
          </form>
        )}
      </section>
      <section className={card}>
        <h2 className="font-semibold">Historique</h2>
        <ul className="mt-3 space-y-3">
          {lead.events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="text-slate-500">
                {e.createdAt.toLocaleString("fr-FR", {
                  timeZone: "Europe/Paris",
                })}
              </span>{" "}
              · {e.detail}
            </li>
          ))}
        </ul>
        {!lead.events.length && (
          <p className="mt-3 text-sm text-slate-500">Aucun contact envoyé.</p>
        )}
      </section>
    </div>
  );
}
