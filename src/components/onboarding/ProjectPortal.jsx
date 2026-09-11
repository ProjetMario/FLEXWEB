import { useEffect, useState, useRef } from "react";
import { api, money, readToken, saveToken } from "./api";
import { isPublicQuote as hasPublicQuote, isInclusiveQuote, quoteTaxLabel } from "../../../apps/saas-platform/lib/automation/public-quote-pricing";
const labels = {
  NEW: "Nous étudions votre demande",
  AWAITING_PAYMENT: "Votre proposition est prête",
  BRIEF: "Préparons les contenus",
  DRAFT_READY: "Votre brouillon est en contrôle",
  CLIENT_REVIEW: "Votre site attend votre avis",
  REVISION_REQUESTED: "Vos corrections ont été transmises",
  APPROVED: "Votre site est validé",
  LIVE: "Votre site est en ligne",
  CANCELED: "Votre projet est arrêté",
};
export default function ProjectPortal() {
  const [token, setToken] = useState(""),
    [project, setProject] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [accepted, setAccepted] = useState(false);
  const ticketKey = useRef(null);
  const isPublicQuote = hasPublicQuote(project?.offer);
  const taxLabel = quoteTaxLabel(project?.offer);
  const inclusive = isInclusiveQuote(project?.offer);
  const quoteOnly = project?.offer?.quoteOnly === true;
  async function refresh(key) {
    try {
      setProject(await api("status", {}, key));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get(
      "cle",
    );
    const key = fromHash || readToken();
    if (key && /^[a-f0-9]{64}$/.test(key)) {
      saveToken(key);
      setToken(key);
      if (readToken() === key)
        history.replaceState(null, "", location.pathname + location.search);
      refresh(key);
    } else {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (
      !token ||
      !project ||
      !(
        project.stage === "AWAITING_PAYMENT" ||
        (project.stage === "BRIEF" && project.briefSubmitted)
      )
    )
      return;
    const id = setInterval(() => refresh(token), 15000);
    return () => clearInterval(id);
  }, [token, project?.stage, project?.briefSubmitted]);
  async function perform(action, data = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(action, data, token);
      if (result.url) {
        const url = new URL(result.url);
        if (
          !["checkout.stripe.com", "billing.stripe.com"].includes(
            url.hostname,
          ) ||
          url.protocol !== "https:"
        )
          throw new Error("Lien de paiement invalide.");
        window.location.assign(result.url);
        return;
      }
      await refresh(token);
      setNotice(
        action === "brief"
          ? "Votre brief a été enregistré."
          : action === "approve"
            ? "Merci, votre validation a été enregistrée."
            : "Votre demande a été enregistrée.",
      );
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/espace-projet/#cle=${token}`,
      );
      setNotice("Lien privé copié. Conservez-le et ne le partagez pas.");
    } catch {
      setNotice(
        `Votre lien privé : ${location.origin}/espace-projet/#cle=${token}`,
      );
    }
  }
  if (loading) return <p role="status">Ouverture de votre espace privé…</p>;
  if (!token)
    return (
      <div className="flow-card">
        <h1>Retrouvez votre projet.</h1>
        <p className="flow-intro">
          Ouvrez le lien privé obtenu à la création de votre demande ou reçu par
          e-mail. Si vous l’avez perdu, contactez-nous.
        </p>
        <a className="flow-button" href="mailto:contact@flex-web.fr">
          Contacter FLEX-WEB
        </a>
        <div className="flow-actions">
          <a href="/demarrer/">Démarrer un nouveau projet</a>
        </div>
      </div>
    );
  return (
    <>
      <p className="flow-eyebrow">Votre espace privé</p>
      <h1>{project?.companyName || "Mon projet"}</h1>
      <p className="flow-intro">
        {labels[project?.stage] || "Suivi du projet"}
      </p>
      <div className="flow-actions flow-no-print">
        <button
          className="flow-button secondary"
          onClick={() => refresh(token)}
          disabled={busy}
        >
          Actualiser
        </button>
        <button className="flow-button secondary" onClick={copyLink}>
          Conserver mon lien privé
        </button>
      </div>
      {error && (
        <p className="flow-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p
          className="flow-success"
          role="status"
          style={{ overflowWrap: "anywhere" }}
        >
          {notice}
        </p>
      )}
      {project && (
        <div className="flow-columns" style={{ marginTop: 28 }}>
          <div>
            {project.stage === "NEW" && (
              <section className="flow-card">
                <h2>Votre demande est enregistrée.</h2>
                <p className="flow-intro">
                  {quoteOnly
                    ? "FLEX-WEB étudie votre besoin. Nous reprendrons contact pour préciser le périmètre et vous transmettre un devis personnalisé. Aucun prix ni abonnement n’est engagé par cette demande."
                    : "FLEX-WEB vérifie votre besoin et le périmètre de la prestation. Vous retrouverez ici votre proposition une fois validée."}
                </p>
                <p className="flow-note">
                  Référence : {project.id.slice(0, 8).toUpperCase()}
                </p>
              </section>
            )}
            {project.stage === "AWAITING_PAYMENT" && (
              <section className="flow-card">
                <h2>Votre proposition {project.quoteReference}</h2>
                <p className="flow-note">
                  Fleximmo / FLEX-WEB · SIREN 989 123 633
                  <br />
                  93 chemin de la Combe, 73420 Voglans
                </p>
                <ul className="flow-list">
                  {project.offer.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className="flow-detail">
                  <span>Création du site</span>
                  <strong>{money(project.setupCents)} {taxLabel}</strong>
                </div>
                {project.monthlyCents > 0 && (
                  <div className="flow-detail">
                    <span>{isPublicQuote ? "Options mensuelles choisies" : "Abonnement mensuel"}</span>
                    <strong>{money(project.monthlyCents)} {taxLabel}/mois</strong>
                  </div>
                )}
                <div className="flow-detail">
                  <span>Premier paiement</span>
                  <strong>
                    {money(project.setupCents + project.monthlyCents)} {taxLabel}
                  </strong>
                </div>
                <p className="flow-note">
                  {inclusive ? "La TVA applicable est incluse dans les montants affichés." : "Les taxes applicables et le total TTC sont affichés avant confirmation du paiement."}{" "}
                  {project.monthlyCents > 0
                    ? "L’abonnement commence à la commande, puis est prélevé chaque mois. Résiliation avec préavis de 30 jours selon les CGV."
                    : "Paiement unique. Hébergement et maintenance en option."}{" "}
                  {isPublicQuote ? "Le calendrier et les limites de chaque prestation sont confirmés au devis." : <>Livraison indicative : 24h à 7 jours ouvrés après validation
                  du brief complet. Deux séries de retours sont incluses avant
                  livraison ; les demandes hors périmètre font l’objet d’un
                  devis complémentaire.</>}
                </p>
                <label className="flow-check">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    J’accepte cette proposition pour mon activité
                    professionnelle et les{" "}
                    <a href="/cgv/" target="_blank" rel="noreferrer">
                      conditions de vente du {isPublicQuote ? "11" : "9"} septembre 2026
                    </a>
                    .
                  </span>
                </label>
                <div className="flow-actions">
                  <button
                    className="flow-button"
                    disabled={busy || !accepted || !project.checkoutAvailable}
                    onClick={() => perform("checkout", { accepted })}
                  >
                    {busy ? "Ouverture…" : "Accepter et accéder au paiement"}
                  </button>
                  <button
                    className="flow-button secondary"
                    onClick={() => window.print()}
                  >
                    Imprimer la proposition
                  </button>
                </div>
                {!project.checkoutAvailable && (
                  <p className="flow-note">
                    Votre interlocuteur FLEX-WEB vous accompagne pour organiser
                    le paiement.
                  </p>
                )}
              </section>
            )}
            {project.paymentStatus === "PAST_DUE" && (
              <div className="flow-error">
                Un paiement nécessite votre attention. Consultez la gestion de
                votre abonnement.
              </div>
            )}
            {project.stage === "BRIEF" &&
              !project.briefSubmitted &&
              project.paymentStatus === "PAID" && (
                <BriefForm
                  busy={busy}
                  onSubmit={(data) => perform("brief", data)}
                />
              )}
            {((project.stage === "BRIEF" && project.briefSubmitted) ||
              project.stage === "DRAFT_READY") && (
              <section className="flow-card">
                <h2>Nous préparons votre site.</h2>
                <p className="flow-intro">
                  Votre brief est enregistré. Votre brouillon sera présenté ici
                  après notre contrôle.
                </p>
              </section>
            )}
            {project.pages.length > 0 && (
              <section className="flow-card">
                <h2>Contenus de votre site</h2>
                <p className="flow-note">
                  Vérifiez les textes et les coordonnées. Cet aperçu présente
                  les contenus des pages ; le rendu final et les fonctions sont
                  contrôlés par FLEX-WEB.
                </p>
                {project.pages.map((page) => (
                  <article className="flow-preview" key={page.title}>
                    <h2>{page.title}</h2>
                    {page.sections.map((section, i) => (
                      <div key={i}>
                        {section.type === "header" && (
                          <>
                            <strong>
                              {String(section.config.title || "")}
                            </strong>
                            <p>{String(section.config.subtitle || "")}</p>
                          </>
                        )}
                        {section.type === "text" && (
                          <p>{String(section.config.content || "")}</p>
                        )}
                        {section.type === "cta" && (
                          <p>
                            {String(section.config.title || "")} ·{" "}
                            {String(section.config.buttonText || "")}
                          </p>
                        )}
                      </div>
                    ))}
                  </article>
                ))}
                {project.stage === "CLIENT_REVIEW" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      perform("approve", { confirmed: true });
                    }}
                  >
                    <label className="flow-check" style={{ marginTop: 24 }}>
                      <input type="checkbox" required />
                      J’ai vérifié les contenus et les coordonnées. Je valide
                      cette version.
                    </label>
                    <button className="flow-button" disabled={busy}>
                      Valider les contenus
                    </button>
                    <p className="flow-note">
                      Pour demander des corrections, utilisez le formulaire
                      ci-dessous.
                    </p>
                  </form>
                )}
              </section>
            )}
            {project.stage === "APPROVED" && (
              <div className="flow-success">
                Votre validation a été reçue. FLEX-WEB finalise les
                vérifications et la connexion du domaine avant publication.
              </div>
            )}
            {project.stage === "LIVE" && (
              <section className="flow-card">
                <h2>Demandes reçues sur votre site</h2>
                {!project.inquiries?.length && (
                  <p className="flow-note">
                    Vos nouvelles demandes de devis apparaîtront ici.
                  </p>
                )}
                {project.inquiries?.map((lead) => (
                  <article className="flow-preview" key={lead.id}>
                    <strong>{lead.name}</strong>
                    <p>
                      <a href={`mailto:${lead.email}`}>{lead.email}</a> ·{" "}
                      {lead.phone}
                    </p>
                    <p>{lead.message}</p>
                    <p className="flow-note">
                      {new Date(lead.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </article>
                ))}
              </section>
            )}
            {["PAID", "PAST_DUE", "CANCELED"].includes(
              project.paymentStatus,
            ) && (
              <section className="flow-card">
                <h2>Une modification ou une question ?</h2>
                <p className="flow-note">
                  {project.offer.supportMinutes
                    ? `${project.offer.supportMinutes} minutes de modifications incluses par mois, non reportables. Les travaux supplémentaires sont chiffrés avant intervention.`
                    : "Les modifications sont chiffrées avant intervention."}
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const values = Object.fromEntries(new FormData(form));
                    if (!ticketKey.current)
                      ticketKey.current = crypto.randomUUID();
                    if (
                      await perform("support", {
                        ...values,
                        requestKey: ticketKey.current,
                      })
                    ) {
                      ticketKey.current = null;
                      form.reset();
                    }
                  }}
                >
                  <label>
                    Objet
                    <input
                      name="subject"
                      required
                      minLength={3}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Votre demande
                    <textarea
                      name="message"
                      required
                      minLength={10}
                      maxLength={4000}
                      rows={4}
                    />
                  </label>
                  <button className="flow-button" disabled={busy}>
                    Envoyer ma demande
                  </button>
                </form>
                {project.tickets.map((t) => (
                  <article className="flow-preview" key={t.id}>
                    <strong>{t.subject}</strong>
                    <p className="flow-note">
                      {t.status === "DONE"
                        ? "Traitée"
                        : "En cours de traitement"}
                      {t.minutes > 0 ? ` · ${t.minutes} min` : ""}
                    </p>
                    {t.response && <p>{t.response}</p>}
                  </article>
                ))}
              </section>
            )}
          </div>
          <aside className="flow-aside">
            <h2>{project.offer.name}</h2>
            <p className="flow-price">
              {quoteOnly ? "Sur devis" : <>{money(isPublicQuote ? project.setupCents : (project.monthlyCents || project.setupCents))} {taxLabel}{!isPublicQuote && project.monthlyCents ? "/mois" : ""}</>}
            </p>
            {isPublicQuote && !quoteOnly && <p className="flow-note">Création en paiement unique{project.monthlyCents ? ` · Options choisies : ${money(project.monthlyCents)} ${taxLabel}/mois` : " · Aucune option mensuelle choisie"}</p>}
            <p className="flow-note">
              {project.paymentStatus === "PAID"
                ? "Paiement confirmé"
                : project.paymentStatus === "UNPAID"
                  ? "Aucun paiement confirmé"
                  : project.paymentStatus === "CANCELED"
                    ? "Abonnement arrêté"
                    : "Paiement à régulariser"}
            </p>
            {project.billingAvailable && (
              <button
                className="flow-button secondary"
                disabled={busy}
                onClick={() => perform("billing")}
              >
                Factures et abonnement
              </button>
            )}
            <p className="flow-note" style={{ marginTop: 22 }}>
              Votre lien donne accès à votre projet. Conservez-le dans un
              endroit sûr.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
function BriefForm({ busy, onSubmit }) {
  return (
    <form
      className="flow-card"
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        onSubmit({
          ...values,
          services: String(values.services)
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          contentConfirmed: true,
        });
      }}
    >
      <h2>Le brief de votre site</h2>
      <p className="flow-intro">
        Ces informations serviront à préparer vos pages. Présentez uniquement
        des prestations et des engagements que votre entreprise propose
        réellement.
      </p>
      <label>
        Votre activité et vos clients
        <textarea
          name="description"
          minLength={40}
          maxLength={4000}
          required
          rows={4}
        />
      </label>
      <label>
        Vos prestations (une par ligne, 8 maximum)
        <textarea name="services" required rows={4} />
      </label>
      <label>
        Votre zone d’intervention
        <input name="area" maxLength={250} required />
      </label>
      <label>
        Ce qui vous distingue
        <textarea
          name="advantages"
          minLength={10}
          maxLength={1500}
          required
          rows={3}
        />
      </label>
      <label>
        Votre histoire / présentation
        <textarea
          name="about"
          minLength={30}
          maxLength={3000}
          required
          rows={4}
        />
      </label>
      <div className="flow-fields">
        <label>
          E-mail de contact public
          <input name="contactEmail" type="email" maxLength={254} required />
        </label>
        <label>
          Téléphone public
          <input name="phone" type="tel" maxLength={25} required />
        </label>
      </div>
      <label>
        Lien HTTPS vers votre logo et vos photos (facultatif)
        <input
          name="assetLink"
          type="url"
          maxLength={1000}
          placeholder="https://…"
        />
      </label>
      <p className="flow-note">
        Utilisez un dossier partagé accessible à FLEX-WEB. Aucun fichier n’est
        publié automatiquement.
      </p>
      <label>
        Couleur principale
        <input name="color" type="color" defaultValue="#0071e3" />
      </label>
      <label className="flow-check">
        <input type="checkbox" required />
        Je confirme l’exactitude de ces informations et mes droits d’utilisation
        des contenus fournis.
      </label>
      <button className="flow-button" disabled={busy}>
        {busy ? "Enregistrement…" : "Transmettre mon brief"}
      </button>
    </form>
  );
}
