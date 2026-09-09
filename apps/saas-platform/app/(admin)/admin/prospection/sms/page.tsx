import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { settings } from "@/lib/sms/service";
import { smsStatuses, smsLength } from "@/lib/sms/core";
import { smsAction } from "./actions";
import Connection from "./Connection";
import SmsBody from "./SmsBody";
export const dynamic = "force-dynamic";
const card = "rounded-xl border bg-white p-5 space-y-4";
const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-40";
const input = "mt-1 block w-full rounded-lg border bg-white p-2";
const date = (v: Date | null) =>
  v?.toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) || "À connecter";
export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const [cfg, contacts, suppressionCount] = await Promise.all([
    settings(),
    prisma.smsOutreachContact.findMany({
      include: {
        messages: true,
        events: { orderBy: { createdAt: "desc" }, take: 8 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.smsSuppression.count(),
  ]);
  const messages = contacts.flatMap((c) => c.messages);
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Prospection SMS</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Des artisans avec un mobile professionnel, sans site trouvé après
          vérification. Préparez le message, validez la fiche, puis suivez les
          réponses ici.
        </p>
      </header>
      {params.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {params.error}
        </p>
      )}
      {params.saved && (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">
          {params.saved}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["À vérifier", messages.filter((m) => m.status === "DRAFT").length],
          ["SMS prêts", messages.filter((m) => m.status === "APPROVED").length],
          [
            "Envois confirmés",
            messages.filter((m) => m.status === "SENT").length,
          ],
          ["Numéros à ne plus contacter", suppressionCount],
        ].map(([label, value]) => (
          <div className={card} key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <section className={card}>
        <h2 className="font-semibold">
          {cfg.enabled ? "File active" : "Envois en pause"} · {cfg.sender}
        </h2>
        <p className="text-sm text-slate-600">
          Un premier SMS par entreprise, jusqu’à 5 par jour du lundi au
          vendredi, entre 9 h et 17 h (Paris). Aucune relance SMS automatique.
          Toute réponse arrête la file pour ce numéro ; STOP l’ajoute à la liste
          de non-contact. Un envoi non confirmé bloque les suivants.
        </p>
        <form action={smsAction} className="space-y-3">
          {!cfg.enabled && (
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="confirm" required />
              Je souhaite envoyer les SMS validés et j’ai vérifié le
              fonctionnement du scénario Zapier.
            </label>
          )}
          <button
            name="action"
            value={cfg.enabled ? "pause" : "enable"}
            className={button}
            disabled={
              !cfg.enabled &&
              (!cfg.webhookVerifiedAt || !cfg.dispatchVerifiedAt)
            }
          >
            {cfg.enabled
              ? "Mettre les envois en pause"
              : "Activer les SMS validés"}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          Réception Onoff testée : {date(cfg.webhookVerifiedAt)} · Connexion
          Zapier testée : {date(cfg.dispatchVerifiedAt)}. Ces tests de connexion
          n’envoient aucun SMS.
        </p>
      </section>
      <details
        className={card}
        open={!cfg.webhookVerifiedAt || !cfg.dispatchVerifiedAt}
      >
        <summary className="cursor-pointer font-semibold">
          Raccorder Onoff et Zapier
        </summary>
        <p className="text-sm">
          L’envoi utilise l’action officielle Onoff « Send a SMS » dans Zapier.
          Le webhook Onoff confirme les envois et remonte les réponses. Un
          abonnement Zapier adapté peut être nécessaire.
        </p>
        <Connection configured={!!cfg.webhookKeyHash} />
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            Dans Onoff, ouvrez{" "}
            <a
              className="text-blue-700 underline"
              href="https://admin.onoffbusiness.com/integrations"
              target="_blank"
              rel="noreferrer"
            >
              Intégrations → Onoff SMS Webhook
            </a>
            . URL :{" "}
            <code className="break-all">
              https://flexweb-gestion.netlify.app/api/sms/onoff
            </code>
            . Collez la clé webhook dans « API Key », puis intégrez.
          </li>
          <li>
            Dans Zapier : Schedule → Webhooks POST → Filter → Onoff Send a SMS.
            Le POST appelle{" "}
            <code className="break-all">
              https://flexweb-gestion.netlify.app/api/sms/dispatch
            </code>{" "}
            avec l’en-tête <code>X-API-KEY</code> et la clé Zapier. Testez avec{" "}
            <code>{'{"mode":"test"}'}</code>.
          </li>
          <li>
            En fonctionnement, utilisez <code>mode: claim</code> et un{" "}
            <code>requestId</code> unique et stable par exécution. Continuez
            seulement si <code>send</code> vaut true ; mappez <code>from</code>,{" "}
            <code>to</code> et <code>text</code> vers Onoff. Désactivez les
            nouveaux essais automatiques du Zap : un envoi incertain doit être
            vérifié dans Onoff.
          </li>
        </ol>
      </details>
      <section className={card}>
        <h2 className="font-semibold">
          Ajouter une entreprise repérée sur Google
        </h2>
        <p className="text-sm text-slate-600">
          L’absence de bouton « Site web » est un indice. Recherchez aussi le
          nom de l’entreprise, sa ville et son numéro avant de la qualifier.
        </p>
        <form action={smsAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="action" value="add" />
          {[
            ["companyName", "Entreprise", "text"],
            ["city", "Ville", "text"],
            ["phone", "Mobile professionnel (06 ou 07)", "tel"],
            ["sourceUrl", "Lien de la fiche où le numéro est publié", "url"],
            ["websiteCheckUrl", "Lien de la recherche du site internet", "url"],
          ].map(([name, label, type]) => (
            <label className="text-sm" key={name}>
              {label}
              <input
                name={name}
                type={type}
                className={input}
                required
                maxLength={name.includes("Url") ? 2000 : 150}
              />
            </label>
          ))}
          <div className="self-end">
            <button className={button}>Créer la fiche et le brouillon</button>
          </div>
        </form>
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Entreprises et messages</h2>
        {contacts.length === 0 && (
          <p className="rounded-xl border border-dashed p-8 text-slate-500">
            Aucune entreprise ajoutée. La collecte ne reprend pas vos contacts
            personnels Onoff.
          </p>
        )}
        {contacts.map((c) => {
          const m = c.messages[0];
          if (!m) return null;
          const locked = !!c.stoppedAt || !!m.attemptedAt || !!m.sentAt;
          const stale =
            m.status === "DISPATCHED" &&
            m.attemptedAt &&
            Date.now() - m.attemptedAt.getTime() > 15 * 60000;
          const length = smsLength(m.body);
          return (
            <article key={c.id} id={c.id} className={card}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{c.companyName}</h3>
                  <p className="text-sm text-slate-500">
                    {c.city} · {c.phone}
                  </p>
                </div>
                <span className="text-sm font-medium">
                  {c.stopReason === "STOP"
                    ? "Ne plus contacter"
                    : c.stopReason === "REPLIED"
                      ? "Réponse à lire"
                      : smsStatuses[stale ? "REVIEW" : m.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  Vérifier la source du numéro
                </a>
                <a
                  href={c.websiteCheckUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  Vérifier la recherche du site
                </a>
                <a
                  href="https://phone.onoffbusiness.com/messages"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  Lire les échanges dans Onoff
                </a>
              </div>
              <form action={smsAction} className="space-y-4">
                <input type="hidden" name="id" value={c.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Résultat de la recherche
                    <select
                      name="websiteFinding"
                      disabled={locked}
                      defaultValue={c.websiteFinding}
                      className={input}
                    >
                      <option value="TO_CHECK">À vérifier</option>
                      <option value="NOT_FOUND">
                        Aucun site trouvé après recherche
                      </option>
                      <option value="HAS_WEBSITE">
                        Un site existe : exclure
                      </option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Droit de contacter par SMS
                    <select
                      name="contactBasis"
                      disabled={locked}
                      defaultValue={c.contactBasis}
                      className={input}
                    >
                      <option value="TO_CHECK">À vérifier</option>
                      <option value="CONSENT">Accord SMS recueilli</option>
                      <option value="B2B">
                        Prospection professionnelle pertinente
                      </option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  Preuve / contexte du contact
                  <textarea
                    name="evidence"
                    rows={2}
                    readOnly={locked}
                    maxLength={1500}
                    defaultValue={c.evidence || ""}
                    className={input}
                    placeholder="Date et origine de l’accord, ou contexte professionnel, information et moyen d’opposition."
                  />
                </label>
                <SmsBody body={m.body} locked={locked} />
                <p className="text-xs text-slate-500">
                  Texte enregistré : {length.segments} SMS estimé(s), encodage{" "}
                  {length.encoding}. Numéro public ne signifie pas accord SMS.
                </p>
                {!locked && (
                  <>
                    <label className="flex gap-2 text-sm">
                      <input name="verified" type="checkbox" />
                      J’ai vérifié le numéro professionnel, l’absence de site
                      trouvé et le texte. La personne a donné son accord ou la
                      sollicitation est liée à son activité, avec information et
                      opposition possible.
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button name="action" value="save" className={button}>
                        Enregistrer le brouillon
                      </button>
                      <button
                        name="action"
                        value="approve"
                        className={`${button} bg-slate-900 text-white`}
                      >
                        Valider ce SMS
                      </button>
                    </div>
                  </>
                )}
              </form>
              {!c.stoppedAt && (
                <form action={smsAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <button className={button} name="action" value="close">
                    Arrêter cette prise de contact
                  </button>
                  <button className={button} name="action" value="stop">
                    Enregistrer une opposition
                  </button>
                </form>
              )}
              {(stale || m.status === "REVIEW") && (
                <form
                  action={smsAction}
                  className="space-y-3 rounded-lg bg-amber-50 p-4 text-sm"
                >
                  <input type="hidden" name="action" value="reconcile" />
                  <input type="hidden" name="id" value={c.id} />
                  <p>
                    Vérifiez ce SMS dans Onoff avant de débloquer les suivants.
                  </p>
                  <label className="block">
                    Résultat vérifié
                    <select name="outcome" className={input}>
                      <option value="sent">
                        Le SMS figure dans les envois Onoff
                      </option>
                      <option value="failed">
                        Onoff confirme que le SMS n’a pas été envoyé
                      </option>
                    </select>
                  </label>
                  <label className="block">
                    Référence et résultat de votre contrôle
                    <textarea
                      name="evidence"
                      required
                      minLength={20}
                      maxLength={1000}
                      className={input}
                    />
                  </label>
                  <label className="flex gap-2">
                    <input name="verified" type="checkbox" required />
                    J’ai contrôlé le journal Onoff. Ce SMS ne sera pas renvoyé.
                  </label>
                  <button className={button}>Enregistrer le contrôle</button>
                </form>
              )}
              {c.events.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm">
                    Historique ({c.events.length})
                  </summary>
                  <ul className="mt-3 space-y-3 text-sm">
                    {c.events.map((e) => (
                      <li key={e.id} className="border-l-2 pl-3">
                        <p className="text-xs text-slate-500">
                          {date(e.occurredAt)} · {e.kind}
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {e.detail}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </section>
      <Link
        href="/admin/prospection/outreach"
        className="inline-block text-sm text-blue-700 underline"
      >
        Revenir à la prospection par e-mail
      </Link>
    </div>
  );
}
