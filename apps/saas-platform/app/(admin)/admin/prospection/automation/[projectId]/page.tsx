import Link from "next/link";
import { quoteTaxLabel, type QuoteSnapshot } from "@/lib/automation/public-quote-pricing";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { stages, briefSchema, requiresManualQuote } from "@/lib/automation/core";
import { projectAction, ticketAction, deleteRequest } from "../actions";
export const dynamic = "force-dynamic";
const button =
  "rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white";
const input =
  "mt-2 block w-full rounded-lg border p-3 text-sm text-slate-900 bg-white";
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { projectId } = await params;
  const query = await searchParams;
  const p = await prisma.salesProject.findUnique({ where: { id: projectId } });
  if (!p) notFound();
  const [pages, tickets, events] = await Promise.all([
    p.websiteId
      ? prisma.page.findMany({
          where: { websiteId: p.websiteId },
          include: { sections: { orderBy: { order: "asc" } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.supportTicket.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.automationEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const brief = p.brief ? briefSchema.parse(p.brief) : null;
  const manualQuote = requiresManualQuote(p.offerSnapshot);
  const canEdit = [
    "DRAFT_READY",
    "REVISION_REQUESTED",
    "CLIENT_REVIEW",
  ].includes(p.stage);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link className="text-sm underline" href="/admin/prospection/automation">
        ← Tous les projets
      </Link>
      <h1 className="text-3xl font-semibold">{p.companyName}</h1>
      <p>
        {stages[p.stage]} · {p.paymentStatus}
      </p>
      {query.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {query.error}
        </p>
      )}
      {query.saved && (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">
          Modification enregistrée.
        </p>
      )}
      <section className="rounded-xl border bg-white p-6 text-slate-900">
        <h2 className="text-lg font-semibold">Demande</h2>
        <p className="mt-3">
          {p.contactName} ·{" "}
          <a href={`mailto:${p.email}`} className="underline">
            {p.email}
          </a>{" "}
          · {p.phone}
        </p>
        <p className="mt-2 text-sm">
          {p.businessType} · {p.city} · Démarrage : {p.timeline}
        </p>
        <p className="mt-4 whitespace-pre-wrap">{p.message}</p>
        <p className="mt-4 text-sm">
          {manualQuote ? "Prestation sur mesure — montant à chiffrer" : `Offre ${p.planId} · Création ${p.setupCents / 100} € ${quoteTaxLabel(p.offerSnapshot as QuoteSnapshot)} · Mensualité ${p.monthlyCents / 100} € ${quoteTaxLabel(p.offerSnapshot as QuoteSnapshot)}`}
        </p>
        {manualQuote && <p className="mt-4 rounded-lg bg-blue-50 p-4 text-sm">Préparez un devis distinct avec les fonctionnalités, les montants et le calendrier, puis faites-le accepter par le client. Ce projet reste à qualifier : la proposition et le paiement automatiques sont bloqués pour éviter de facturer un forfait site à une prestation sur mesure.</p>}
        {p.stage === "NEW" && !manualQuote && (
          <form action={projectAction.bind(null, p.id)} className="mt-5">
            <input type="hidden" name="action" value="qualify" />
            <label className="mb-4 flex gap-2 text-sm">
              <input type="checkbox" name="scopeConfirmed" required />
              J’ai vérifié que le besoin entre dans le périmètre et le tarif
              sélectionnés.
            </label>
            <button className={button}>
              Valider le périmètre et ouvrir la proposition
            </button>
          </form>
        )}
      </section>
      <form
        action={projectAction.bind(null, p.id)}
        className="rounded-xl border bg-white p-6 text-slate-900"
      >
        <input type="hidden" name="action" value="renew-access" />
        <h2 className="text-lg font-semibold">Accès client</h2>
        <p className="my-3 text-sm">
          Le lien privé expire après 180 jours. En cas de perte, un nouveau lien
          peut être placé dans la file d’envoi au client ; le précédent sera
          invalidé. Vérifiez que les e-mails sont activés avant cette action.
        </p>
        <button className={button}>
          Renouveler et préparer l’envoi du lien
        </button>
      </form>
      {brief && (
        <section className="rounded-xl border bg-white p-6 text-slate-900">
          <h2 className="text-lg font-semibold">Brief reçu</h2>
          <p className="mt-3 whitespace-pre-wrap">{brief.description}</p>
          <p className="mt-3">
            Zone : {brief.area} · Couleur : {brief.color}
          </p>
          {brief.assetLink && (
            <a
              className="mt-3 inline-block text-blue-700 underline"
              href={brief.assetLink}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir le dossier de contenus fourni
            </a>
          )}
        </section>
      )}
      {!!pages.length && (
        <section className="rounded-xl border bg-white p-6 text-slate-900">
          <h2 className="text-lg font-semibold">
            Brouillon · version {p.draftVersion}
          </h2>
          <form action={projectAction.bind(null, p.id)}>
            <input type="hidden" name="action" value="edit" />
            {pages.map((page) => (
              <fieldset className="mt-6 border-t pt-5" key={page.id}>
                <legend className="font-medium">{page.title}</legend>
                {page.sections.map((s) => {
                  const cfg = s.config as Record<string, unknown>;
                  const keys =
                    s.type === "header"
                      ? ["title", "subtitle"]
                      : s.type === "text"
                        ? ["content"]
                        : s.type === "cta"
                          ? ["title", "buttonText", "buttonHref"]
                          : [];
                  return keys.map((k) => (
                    <label className="mt-3 block text-sm" key={`${s.id}:${k}`}>
                      {
                        (
                          {
                            title: "Titre",
                            subtitle: "Sous-titre",
                            content: "Contenu",
                            buttonText: "Texte du bouton",
                            buttonHref: "Lien interne",
                          } as Record<string, string>
                        )[k]
                      }
                      <textarea
                        disabled={!canEdit}
                        name={`${s.id}:${k}`}
                        defaultValue={String(cfg[k] || "")}
                        rows={k === "content" ? 4 : 2}
                        maxLength={8000}
                        className={input}
                      />
                    </label>
                  ));
                })}
              </fieldset>
            ))}
            {canEdit && (
              <button className={`${button} mt-5`}>
                Enregistrer une nouvelle version
              </button>
            )}
          </form>
          {["DRAFT_READY", "REVISION_REQUESTED"].includes(p.stage) && (
            <form
              action={projectAction.bind(null, p.id)}
              className="mt-6 border-t pt-5"
            >
              <input type="hidden" name="action" value="review" />
              <label className="mb-4 flex gap-2 text-sm">
                <input type="checkbox" name="qa" required />
                J’ai vérifié les textes, coordonnées, droits des contenus et le
                périmètre de la prestation.
              </label>
              <button className={button}>
                Présenter cette version au client
              </button>
            </form>
          )}
          {p.stage === "APPROVED" && (
            <form
              action={projectAction.bind(null, p.id)}
              className="mt-6 border-t pt-5"
            >
              <input type="hidden" name="action" value="publish" />
              <p className="mb-4 text-sm">
                La publication exige un domaine principal vérifié avec HTTPS
                dans la plateforme.
              </p>
              <label className="mb-4 flex gap-2 text-sm">
                <input type="checkbox" name="publicationChecks" required />
                J’ai testé le formulaire, les liens, le rendu mobile et vérifié
                les informations légales et le domaine.
              </label>
              <button className={button}>Publier le site validé</button>
            </form>
          )}
        </section>
      )}
      {["NEW", "AWAITING_PAYMENT"].includes(p.stage) && p.paymentStatus === "UNPAID" && !p.stripeSessionId && !p.stripeCustomerId && !p.websiteId && (
        <details className="rounded-xl border bg-white p-6 text-slate-900">
          <summary className="cursor-pointer font-medium">Supprimer cette demande non payée</summary>
          <p className="my-3 text-sm">Le lien privé, les messages en attente et la demande seront supprimés définitivement. Une fiche prospect avec un historique commercial sera conservée.</p>
          <form action={deleteRequest.bind(null, p.id)}>
            <label className="text-sm">Recopiez le nom de l’entreprise
              <input className={input} name="confirmCompany" required autoComplete="off" />
            </label>
            <button className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm text-white">Supprimer la demande</button>
          </form>
        </details>
      )}
      <section className="rounded-xl border bg-white p-6 text-slate-900">
        <h2 className="text-lg font-semibold">Support et temps passé</h2>
        {!tickets.length && (
          <p className="mt-4 text-sm text-slate-500">Aucune demande.</p>
        )}
        {tickets.map((t) => (
          <article key={t.id} className="mt-5 border-t pt-5">
            <h3 className="font-medium">{t.subject}</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm">{t.message}</p>
            <form action={ticketAction.bind(null, p.id, t.id)} className="mt-4">
              <label className="text-sm">
                Réponse
                <textarea
                  name="response"
                  defaultValue={t.response || ""}
                  required
                  maxLength={4000}
                  rows={3}
                  className={input}
                />
              </label>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Temps total consacré (minutes)
                  <input
                    type="number"
                    name="minutes"
                    min="0"
                    max="10000"
                    defaultValue={t.minutes}
                    required
                    className={input}
                  />
                </label>
                <label className="text-sm">
                  Statut
                  <select
                    name="status"
                    defaultValue={t.status}
                    className={input}
                  >
                    <option value="OPEN">Ouvert</option>
                    <option value="DONE">Traité</option>
                  </select>
                </label>
              </div>
              <button className={`${button} mt-4`}>
                Enregistrer la réponse
              </button>
            </form>
          </article>
        ))}
      </section>
      <section className="rounded-xl border bg-white p-6 text-slate-900">
        <h2 className="text-lg font-semibold">Historique</h2>
        <ul className="mt-4 space-y-3">
          {events.map((e) => (
            <li className="text-sm" key={e.id}>
              <span className="text-slate-500">
                {e.createdAt.toLocaleString("fr-FR")} ·{" "}
              </span>
              {e.detail}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
