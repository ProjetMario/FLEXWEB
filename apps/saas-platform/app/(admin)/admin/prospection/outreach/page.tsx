import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { PILOT_KEY, stages, SENDER } from "@/lib/outreach/core";
import { mailboxConfigured } from "@/lib/outreach/mail";
import { campaignAction } from "./actions";
export const dynamic = "force-dynamic";
const card = "rounded-xl border bg-white p-5 text-slate-900";
const button =
  "rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50";
export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const [campaign, mailbox, params] = await Promise.all([
    prisma.outreachCampaign.findUnique({
      where: { key: PILOT_KEY },
      include: {
        leads: {
          include: { messages: { select: { status: true } } },
          orderBy: [{ score: "desc" }, { companyName: "asc" }],
        },
      },
    }),
    prisma.outreachMailbox.findUnique({
      where: { id: "ionos" },
      select: {
        verifiedAt: true,
        syncedAt: true,
        lastError: true,
        needsReview: true,
      },
    }),
    searchParams,
  ]);
  const leads = campaign?.leads || [];
  const ready = !!mailbox?.verifiedAt && mailboxConfigured();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-700">
            Acquisition · pilote local
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Prospection locale</h1>
          <p className="mt-2 text-sm text-slate-500">
            50 plombiers et chauffagistes en Savoie et Haute-Savoie.
          </p>
        </div>
        <form action={campaignAction}>
          <button className={button} name="action" value="run">
            Traiter les tâches
          </button>
        </form>
      </div>
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
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          ["Entreprises repérées", `${leads.length}/50`],
          [
            "Sites contrôlés",
            leads.filter((l) => l.auditState === "DONE").length,
          ],
          [
            "Messages envoyés",
            leads.reduce(
              (n, l) =>
                n + l.messages.filter((m) => m.status === "SENT").length,
              0,
            ),
          ],
          [
            "Réponses à lire",
            leads.filter((l) => l.stage === "REPLIED").length,
          ],
          ["Rendez-vous", leads.filter((l) => l.appointmentId).length],
        ].map(([label, value]) => (
          <div className={card} key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <section className={card}>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              {campaign?.enabled ? "Campagne active" : "Envois en pause"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Vérifie chaque destinataire et les trois brouillons. Après
              activation : 10 messages maximum par jour, du lundi au vendredi de
              9 h à 17 h (Paris), avec deux relances à J+4 et J+10. Une réponse
              détectée, un refus ou une désinscription arrête la séquence.
            </p>
          </div>
          {campaign?.enabled && (
            <form action={campaignAction}>
              <button name="action" value="pause" className={button}>
                Mettre en pause
              </button>
            </form>
          )}
        </div>
        {!campaign?.enabled && (
          <form action={campaignAction} className="mt-4 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" required className="mt-1" />
              Je souhaite lancer les séquences que j’ai validées et j’ai vérifié
              les conditions d’utilisation de ma messagerie pour cette
              prospection professionnelle.
            </label>
            <button
              name="action"
              value="enable"
              className={`${button} bg-slate-900 text-white hover:bg-slate-800`}
              disabled={!ready}
            >
              Activer les séquences validées
            </button>
          </form>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Dernier traitement :{" "}
          {campaign?.lastRunAt?.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
          }) || "pas encore exécuté"}{" "}
          ·{" "}
          {campaign?.lastResult ||
            "Le premier traitement crée la liste pilote."}
        </p>
      </section>
      <section className={card}>
        <h2 className="font-semibold">Boîte IONOS · {SENDER}</h2>
        <p className="mt-2 text-sm">
          {ready
            ? "Connexion vérifiée"
            : mailboxConfigured()
              ? "Mot de passe configuré ; connexion à vérifier"
              : "Connexion à terminer"}
        </p>
        {!mailboxConfigured() && (
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Dans les{" "}
            <a
              href="https://app.netlify.com/projects/flexweb-gestion/configuration/env"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              variables sécurisées Netlify du projet flexweb-gestion
            </a>
            , ajoute <code>IONOS_MAIL_PASSWORD</code> avec le mot de passe de
            cette boîte, pour le contexte Production, en conservant toutes les
            portées disponibles. Il ne faut pas le communiquer dans le chat. Un
            nouveau déploiement de flexweb-gestion est nécessaire pour charger
            cette variable. Clique ensuite sur « Vérifier la connexion ».
          </p>
        )}
        <form action={campaignAction} className="mt-3">
          <button name="action" value="verify" className={button}>
            Vérifier la connexion
          </button>
        </form>
        {mailbox?.lastError && (
          <p className="mt-3 text-sm text-amber-800">{mailbox.lastError}</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          SMTP et IMAP chiffrés. Réponses contrôlées dans la boîte de réception
          toutes les 10 minutes ; évite de déplacer automatiquement ces réponses
          vers un autre dossier. Aucun suivi d’ouverture. La connexion est
          testée sans envoyer d’e-mail.
        </p>
      </section>
      <section>
        <h2 className="mb-3 font-semibold">Entreprises à examiner</h2>
        <p className="mb-4 text-sm text-slate-500">
          Annuaire des entreprises + annuaire RGE de l’ADEME. Une adresse
          publiée ne constitue pas un consentement. Un site non trouvé reste à
          renseigner ; cela ne signifie pas que l’entreprise n’en possède pas.
        </p>
        <div className="grid gap-3 xl:grid-cols-2">
          {leads.map((l) => (
            <Link
              href={`/admin/prospection/outreach/${l.id}`}
              key={l.id}
              className={`${card} block hover:border-blue-400`}
            >
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold break-words">{l.companyName}</h3>
                <span className="shrink-0 text-xs text-blue-700">
                  {stages[l.stage] || l.stage}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {l.city} · {l.postalCode} · {l.activityCode}
              </p>
              <p className="mt-3 text-sm">
                {l.email
                  ? "Adresse publiée à vérifier"
                  : "Adresse professionnelle à renseigner"}{" "}
                ·{" "}
                {l.auditState === "DONE"
                  ? "Contrôle technique disponible"
                  : l.auditState === "PENDING"
                    ? "Diagnostic en attente"
                    : "Diagnostic à vérifier manuellement"}
              </p>
              {l.messages.some((m) => m.status === "REVIEW") && (
                <p className="mt-2 text-sm text-amber-800">
                  Un envoi demande une vérification manuelle.
                </p>
              )}
            </Link>
          ))}
        </div>
        {!leads.length && (
          <p className={card}>
            Clique sur « Traiter les tâches » pour préparer les premières
            fiches. Le traitement se poursuit ensuite automatiquement.
          </p>
        )}
      </section>
    </div>
  );
}
