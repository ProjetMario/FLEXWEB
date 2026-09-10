import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prospect } from "@prisma/client";
import { crmAction } from "@/app/(admin)/admin/prospection/crm-actions";
import { WEBSITE_LABELS, CHANNEL_LABELS } from "@/lib/prospection/crm-core";
import { STATUS_LABELS } from "@/lib/prospection/status";
import AppointmentDate from "@/app/(admin)/admin/prospection/outreach/AppointmentDate";
const input = "mt-1 block w-full rounded-lg border bg-white p-2 text-sm";
const button =
  "rounded-lg border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-40";
export default async function CrmPanel({
  prospect: p,
}: {
  prospect: Prospect;
}) {
  const templates = await prisma.crmMessageTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Qualification et canal de contact</h2>
        {p.doNotContactAt && (
          <p role="status" className="rounded bg-red-50 p-3 text-red-800">
            Ne plus contacter · {p.stopReason}. L’opposition s’applique aux SMS
            et aux e-mails.
          </p>
        )}
        <p className="text-sm text-slate-600">
          {p.siren ? `SIREN ${p.siren} · ` : ""}
          {p.registryState || "Activité à vérifier"} ·{" "}
          {p.source || "Source à renseigner"}
        </p>
        <a
          className="text-blue-700 underline text-sm"
          href={`https://www.google.com/search?q=${encodeURIComponent(p.companyName + " " + (p.city || "") + " site internet")}`}
          target="_blank"
          rel="noreferrer"
        >
          Rechercher le site de cette entreprise
        </a>
        <form action={crmAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={p.id} />
          <label className="text-sm">
            Téléphone professionnel
            <input name="phone" className={input} defaultValue={p.phone} />
          </label>
          <label className="text-sm">
            Courriel professionnel
            <input
              type="email"
              name="email"
              className={input}
              defaultValue={p.email || ""}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Fiche source
            <input
              required
              type="url"
              name="sourceUrl"
              className={input}
              defaultValue={p.sourceUrl || p.googleBusinessUrl || ""}
            />
          </label>
          <label className="text-sm">
            Résultat de la recherche
            <select
              name="websiteFinding"
              className={input}
              defaultValue={p.websiteFinding}
            >
              {Object.entries(WEBSITE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Canal choisi
            <select
              name="preferredChannel"
              className={input}
              defaultValue={p.preferredChannel}
            >
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Site trouvé, le cas échéant
            <input
              type="url"
              name="website"
              className={input}
              defaultValue={p.website || ""}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Résultat du contrôle et pertinence de l’offre
            <textarea
              name="websiteEvidence"
              className={input}
              rows={3}
              defaultValue={p.websiteEvidence || ""}
              placeholder="Sources consultées, entreprise encore active, coordonnées professionnelles et raison de proposer un site…"
            />
          </label>
          <label className="flex gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="verified" />
            J’ai vérifié la source, l’activité et le résultat de la recherche.
          </label>
          <button className={button} name="action" value="qualify">
            Enregistrer la qualification
          </button>
        </form>
        <div className="flex flex-wrap gap-3">
          <form action={crmAction}>
            <input type="hidden" name="id" value={p.id} />
            <select
              name="templateId"
              aria-label="Modèle SMS"
              className="mb-2 block rounded border p-2 text-sm"
            >
              <option value="">Message proposé par FLEX-WEB</option>
              {templates
                .filter((t) => t.channel === "SMS")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button
              className={button}
              name="action"
              value="sms"
              disabled={!!p.doNotContactAt || !/^\+33[67]/.test(p.phone)}
            >
              Préparer le SMS
            </button>
          </form>
          <form action={crmAction}>
            <input type="hidden" name="id" value={p.id} />
            <select
              name="templateId"
              aria-label="Modèle EMAIL"
              className="mb-2 block rounded border p-2 text-sm"
            >
              <option value="">Message proposé par FLEX-WEB</option>
              {templates
                .filter((t) => t.channel === "EMAIL")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            <button
              className={button}
              name="action"
              value="email"
              disabled={!!p.doNotContactAt || !p.email}
            >
              Préparer les e-mails
            </button>
          </form>
        </div>
        <p className="text-xs text-slate-500">
          Les messages restent en brouillon jusqu’à leur validation. Le canal
          choisi évite deux prises de contact automatiques simultanées.
        </p>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Suivi commercial</h2>
        <form action={crmAction} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={p.id} />
          <label className="text-sm">
            Étape
            <select name="status" className={input} defaultValue={p.status}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Valeur du devis (€)
            <input
              name="estimatedValue"
              type="number"
              min="0"
              step="1"
              defaultValue={p.estimatedValue || 0}
              className={input}
            />
          </label>
          <label className="text-sm">
            Abonnement mensuel (€)
            <input
              name="monthlyPrice"
              type="number"
              min="0"
              step="1"
              defaultValue={p.monthlyPrice || 0}
              className={input}
            />
          </label>
          <button name="action" value="status" className={button}>
            Mettre à jour
          </button>
        </form>
        <form action={crmAction} className="space-y-3">
          <input type="hidden" name="id" value={p.id} />
          <label className="text-sm">
            Ajouter une note
            <textarea required name="note" rows={2} className={input} />
          </label>
          <button className={button} name="action" value="note">
            Ajouter la note
          </button>
        </form>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold">Prochaine action</h2>
        <form action={crmAction} className="space-y-3">
          <input type="hidden" name="id" value={p.id} />
          <AppointmentDate label="Date du rappel" />
          <label className="text-sm">
            Action à effectuer
            <input
              name="note"
              className={input}
              placeholder="Rappeler, répondre, envoyer un devis…"
            />
          </label>
          <button
            className={button}
            name="action"
            value="follow-up"
            disabled={!!p.doNotContactAt}
          >
            Planifier un rappel
          </button>
          <button className={button} name="action" value="appointment" disabled={!!p.doNotContactAt}>Créer un rendez-vous à cette date</button>
        </form>
        <Link
          href="/admin/prospection/follow-ups"
          className="text-sm text-blue-700 underline"
        >
          Voir les rappels
        </Link>
        <details>
          <summary className="cursor-pointer text-sm text-red-700">
            Enregistrer une demande de non-contact
          </summary>
          <form action={crmAction} className="mt-3">
            <input type="hidden" name="id" value={p.id} />
            <p className="mb-2 text-sm">
              Arrête les SMS et les e-mails en attente pour cette entreprise.
            </p>
            <button
              className={button}
              name="action"
              value="stop"
              disabled={!!p.doNotContactAt}
            >
              Ne plus contacter cette entreprise
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
