import { useEffect, useState, useRef } from "react";
import { websiteOffers, pricingOptions, publicQuoteVersion } from "../../data/pricing.ts";
import { trackLead } from "../../lib/analytics.ts";
import { api, createIdentity, money, saveToken } from "./api";

const bespokeOffers = {
  automation: {
    id: "achat",
    name: "Automatisation IA sur mesure",
    features: ["Étude des tâches et outils existants", "Périmètre et intégrations définis ensemble", "Proposition personnalisée avant toute réalisation"],
  },
  application: {
    id: "achat",
    name: "Application web ou mobile",
    features: ["Analyse des utilisateurs et fonctionnalités", "Étude des connexions à vos outils", "Développement sur mesure après validation du devis"],
  },
};

export default function StartProject() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [service, setService] = useState("site");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [data, setData] = useState({
    companyName: "", contactName: "", email: "", phone: "", city: "", businessType: "",
    planId: "essentielle", message: "", timeline: "a-definir", privacyConsent: false,
    professional: false, websiteTrap: "", source: "site",
  });
  const form = useRef(null), identity = useRef(null), heading = useRef(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const rawService = (query.get("service") || "").toLowerCase();
    const requestedService = ["automation", "ia", "seo"].includes(rawService)
      ? "automation" : ["application", "app"].includes(rawService) ? "application" : "site";
    // The versioned quote selection lets the server derive new prices while
    // keeping existing CRM identifiers and historical contracts intact.
    const planId = requestedService !== "site" || ["achat", "croissance"].includes(query.get("offre"))
      ? "achat" : "essentielle";
    setData((d) => ({ ...d, planId, source: (query.get("utm_source") || "site").slice(0, 160) }));
    setService(requestedService);
    try { identity.current = JSON.parse(sessionStorage.getItem("flexweb-intake-v2") || "null"); }
    catch { identity.current = null; }
    setReady(true);
  }, []);
  const bespoke = service !== "site";
  const offerChoices = bespoke ? [bespokeOffers[service]] : websiteOffers;
  const displayedOffer = offerChoices.find((o) => o.id === data.planId) || offerChoices[0];
  const activeOptions = pricingOptions.filter((option) => selectedOptions.includes(option.id));
  const set = (e) => setData((d) => ({ ...d, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  function next(e) {
    e.preventDefault();
    if (!form.current.reportValidity()) return;
    setError("");
    setStep((s) => s + 1);
  }
  async function submit(e) {
    e.preventDefault();
    if (busy || !form.current.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      if (!identity.current) identity.current = createIdentity();
      try { sessionStorage.setItem("flexweb-intake-v2", JSON.stringify(identity.current)); } catch {}
      const quoteSummary = bespoke
        ? `Demande de devis : ${displayedOffer.name}. Budget et périmètre à chiffrer, aucun forfait site sélectionné.`
        : `Demande de devis : ${displayedOffer.name}, ${money(displayedOffer.setupCents)} HT en paiement unique. Options demandées : ${activeOptions.length ? activeOptions.map((o) => `${o.name} (${money(o.monthlyCents)} HT/mois)`).join(" ; ") : "aucune mensualité"}.`;
      await api("intake", {
        ...data, ...identity.current,
        publicQuote: bespoke
          ? { version: publicQuoteVersion, service }
          : { version: publicQuoteVersion, service: "site", tier: displayedOffer.id === "essentielle" ? "simple" : "complete", options: selectedOptions },
        message: `${quoteSummary}\nConditions à confirmer dans une proposition adaptée avant tout paiement.\n\nBesoin du client :\n${data.message}`,
      });
      saveToken(identity.current.accessToken);
      trackLead("project_quote", service);
      try { sessionStorage.removeItem("flexweb-intake-v2"); } catch {}
      window.location.assign(`/espace-projet/#cle=${identity.current.accessToken}`);
    } catch (err) {
      setError(err.name === "TimeoutError"
        ? "La connexion a pris trop de temps. Réessayez : votre demande ne sera pas dupliquée."
        : err.message);
      setBusy(false);
    }
  }
  const field = (name, label, type = "text", maxLength = 160) => (
    <label>{label}<input name={name} type={type} value={data[name]} onChange={set} required maxLength={maxLength}
      autoComplete={{ contactName: "name", companyName: "organization", email: "email", phone: "tel", city: "address-level2" }[name] || "off"} /></label>
  );
  return (
    <>
      <p className="flow-eyebrow">Votre projet, étape par étape</p>
      <h1 ref={heading}>{service === "automation" ? "Automatisez vos tâches." : service === "application" ? "Votre application sur mesure." : "Votre site internet."}<br />Commençons par votre besoin.</h1>
      <p className="flow-intro">{bespoke
        ? "Présentez votre activité, vos outils et ce que vous souhaitez améliorer. Nous préparons une proposition personnalisée avant tout engagement."
        : "Choisissez votre site à 299 € ou 990 € HT en paiement unique, puis vos éventuelles options. Nous confirmons le périmètre dans votre devis avant tout paiement."}</p>
      <ol className="flow-steps" aria-label="Étapes de la demande">
        {["Votre activité", "Votre offre", "Votre projet"].map((s, i) => <li key={s} aria-current={step === i ? "step" : undefined}>{i + 1}. {s}</li>)}
      </ol>
      <div className="flow-columns">
        <form ref={form} onSubmit={step === 2 ? submit : next} className="flow-card" aria-busy={busy}>
          <fieldset className="flow-fieldset" disabled={!ready || busy}>
            <h2>{["Faisons connaissance", bespoke ? "Votre prestation" : "Choisissez votre formule", "Ce que vous souhaitez accomplir"][step]}</h2>
            {step === 0 && <>
              <div className="flow-fields">
                {field("companyName", "Entreprise")}{field("contactName", "Votre nom", "text", 120)}
                {field("email", "E-mail professionnel", "email", 254)}{field("phone", "Téléphone", "tel", 25)}
                {field("city", "Ville", "text", 100)}{field("businessType", "Métier / activité", "text", 100)}
              </div>
              <label className="flow-check"><input name="professional" type="checkbox" checked={data.professional} onChange={set} required />Je fais cette demande pour mon activité professionnelle.</label>
            </>}
            {step === 1 && <>
              {offerChoices.map((o) => <label className="flow-offer" key={o.id}>
                <input type="radio" name="planId" value={o.id} checked={data.planId === o.id} onChange={set} />
                {o.name}
                <span className="flow-price">{bespoke ? "Sur devis" : `${money(o.setupCents)} HT`}</span>
                <span className="flow-note">{bespoke ? "Proposition personnalisée après étude de votre besoin." : "Création payée une seule fois. Options mensuelles facultatives."}</span>
                <ul className="flow-list">{o.features.map((f) => <li key={f}>{f}</li>)}</ul>
              </label>)}
              {!bespoke && <fieldset className="flow-fieldset">
                <legend>Options facultatives</legend>
                <p className="flow-note">Choisissez l’une, les deux ou aucune. Les interventions et limites seront précisées au devis.</p>
                {pricingOptions.map((option) => <label className="flow-offer" key={option.id}>
                  <input type="checkbox" name={option.id} checked={selectedOptions.includes(option.id)} onChange={(e) => setSelectedOptions((current) => e.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} />
                  {option.name} · +{money(option.monthlyCents)} HT / mois
                  <span className="flow-note">{option.description}</span>
                </label>)}
              </fieldset>}
            </>}
            {step === 2 && <>
              <label>Votre besoin<textarea name="message" value={data.message} onChange={set} required minLength={15} maxLength={2400} rows={5}
                placeholder={service === "automation" ? "Quelles tâches répétez-vous ? Quels outils utilisez-vous ?" : service === "application" ? "Qui utilisera votre application et quelles fonctions sont nécessaires ?" : "Votre activité, vos clients et les demandes que vous souhaitez recevoir…"} /></label>
              <label>Quand souhaitez-vous démarrer ?<select name="timeline" value={data.timeline} onChange={set}>
                <option value="a-definir">À définir ensemble</option><option value="rapidement">Dès que possible</option><option value="1-3-mois">Dans 1 à 3 mois</option>
              </select></label>
              <div hidden aria-hidden="true"><label>Votre deuxième site<input name="websiteTrap" value={data.websiteTrap} onChange={set} autoComplete="off" tabIndex={-1} /></label></div>
              <label className="flow-check"><input name="privacyConsent" type="checkbox" checked={data.privacyConsent} onChange={set} required />
                <span>J’accepte l’utilisation de mes informations pour traiter mon projet et recevoir les messages nécessaires à son suivi. <a href="/privacy/" target="_blank" rel="noreferrer">Confidentialité</a>.</span>
              </label>
              <p className="flow-note">Cette demande est gratuite et ne vaut pas commande. Les fonctionnalités et conditions sont confirmées avant paiement.</p>
            </>}
            {error && <p className="flow-error" role="alert">{error}</p>}
            <div className="flow-actions">
              {step > 0 && <button className="flow-button secondary" type="button" disabled={busy} onClick={() => { setStep((s) => s - 1); setError(""); }}>Retour</button>}
              <button className="flow-button" disabled={busy} type="submit">{busy ? "Enregistrement…" : step === 2 ? "Recevoir mon devis" : "Continuer"}</button>
            </div>
          </fieldset>
        </form>
        <aside className="flow-aside">
          <p className="flow-eyebrow">Votre sélection</p>
          <h2>{displayedOffer.name}</h2>
          <p className="flow-price">{bespoke ? "Sur devis" : `${money(displayedOffer.setupCents)} HT`}</p>
          <p className="flow-note">{bespoke ? "Le budget dépend des fonctionnalités, intégrations et outils nécessaires." : "Création en paiement unique. Hébergement et nom de domaine précisés au devis."}</p>
          {!bespoke && (activeOptions.length ? <ul className="flow-list">{activeOptions.map((o) => <li key={o.id}>{o.name} : +{money(o.monthlyCents)} HT / mois</li>)}</ul> : <p className="flow-note">Aucune option mensuelle sélectionnée.</p>)}
          <p className="flow-note">Prix hors taxes. Les taxes et le total seront indiqués dans votre proposition avant validation.</p>
          <ul className="flow-list"><li>Un interlocuteur en Savoie</li><li>Un accompagnement partout en France</li><li>Un périmètre validé ensemble</li><li>Un espace privé pour suivre votre projet</li></ul>
          <p className="flow-note">Le calendrier est confirmé dans le devis selon le projet et les contenus disponibles.</p>
          <p className="flow-note"><a href="/pricing/">Revoir les tarifs et les prestations</a></p>
        </aside>
      </div>
    </>
  );
}
