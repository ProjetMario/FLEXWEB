import { useEffect, useState, useRef } from "react";
import { websiteOffers, automationOffers, pricingOptions, publicQuoteVersion } from "../../data/pricing.ts";
import { leadSource } from "../../lib/acquisition.ts";
import { trackLead } from "../../lib/analytics.ts";
import { isProspectSlug, validProspectContext } from "../../lib/prospect-context.mjs";
import { api, createIdentity, money, saveToken } from "./api";

const packNames = { essentielle: "Standard", visibilite: "Medium", "crm-automation": "Premium" };

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
  const [sitePlan, setSitePlan] = useState("essentielle");
  const [automationPlan, setAutomationPlan] = useState("crm-automation");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [prospectContext, setProspectContext] = useState(null);
  const [data, setData] = useState({
    companyName: "", contactName: "", email: "", phone: "", city: "", businessType: "",
    planId: "essentielle", message: "", timeline: "a-definir", privacyConsent: false,
    professional: false, websiteTrap: "", source: "site",
  });
  const form = useRef(null), identity = useRef(null), heading = useRef(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const rawService = (query.get("service") || "").toLowerCase();
    const requestedService = ["automation", "ia"].includes(rawService) || query.get("offre") === "crm-automation"
      ? "automation" : ["application", "app"].includes(rawService) ? "application" : "site";
    // The versioned quote selection lets the server derive new prices while
    // keeping existing CRM identifiers and historical contracts intact.
    const planId = requestedService === "application" ? "achat"
      : requestedService === "automation" ? (query.get("offre") === "sur-mesure" ? "achat" : "crm-automation")
      : rawService === "seo" || ["achat", "croissance", "visibilite"].includes(query.get("offre")) ? "visibilite" : "essentielle";
    setData((d) => ({ ...d, planId, source: "site" }));
    setService(requestedService);
    if (requestedService === "site") setSitePlan(planId);
    if (requestedService === "automation") setAutomationPlan(planId);
    try { identity.current = JSON.parse(sessionStorage.getItem("flexweb-intake-v2") || "null"); }
    catch { identity.current = null; }
    const slug = query.get("maquette");
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 4000);
    async function prefill() {
      try {
        if (isProspectSlug(slug)) {
          const response = await fetch(`/maquettes/contexte/${slug}.json`, {signal: controller.signal, credentials: "omit"});
          if (response.ok) {
            const context = await response.json();
            if (active && validProspectContext(context, slug)) {
              setProspectContext(context);
              setData(d => ({...d, companyName: context.name, city: context.city, businessType: context.activity,
                message: query.get("intent") === "modification"
                  ? `Je souhaite adapter la maquette proposée pour ${context.name}. Mes modifications : `
                  : `Je souhaite échanger sur le site proposé pour ${context.name}. `}));
            }
          }
        }
      } catch { /* The quote form remains available if a preview has expired. */ }
      finally { clearTimeout(timer); if (active) setReady(true); }
    }
    prefill();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, []);
  const offerChoices = prospectContext && data.planId !== "achat"
    ? [...websiteOffers, ...automationOffers]
    : service === "site" ? websiteOffers : service === "automation" ? [...automationOffers, bespokeOffers.automation] : [bespokeOffers.application];
  const steps = prospectContext ? ["Vos coordonnées", "Votre pack et votre projet"] : ["Votre activité", "Votre offre", "Votre projet"];
  const finalStep = steps.length - 1;
  const displayedOffer = offerChoices.find((o) => o.id === data.planId) || offerChoices[0];
  const bespoke = !displayedOffer.setupCents;
  const activeOptions = pricingOptions.filter((option) => selectedOptions.includes(option.id));
  const set = (e) => {
    if (e.target.name === "planId") {
      const nextService = prospectContext && e.target.value !== "achat"
        ? e.target.value === "crm-automation" ? "automation" : "site"
        : service;
      setService(nextService);
      if (nextService === "site") setSitePlan(e.target.value);
      if (nextService === "automation") setAutomationPlan(e.target.value);
    }
    setData((d) => ({ ...d, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  };
  const changeService = (value) => {
    setService(value); setError("");
    setData(d => ({...d, planId: value === "site" ? sitePlan : value === "automation" ? automationPlan : "achat"}));
  };
  useEffect(() => { if (ready) heading.current?.focus(); }, [step, ready]);
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
        : `Demande de devis : ${displayedOffer.name}, ${money(displayedOffer.setupCents)} TTC en paiement unique. Options demandées : ${activeOptions.length ? activeOptions.map((o) => `${o.name} (${money(o.monthlyCents)} TTC/mois)`).join(" ; ") : "aucune mensualité"}.`;
      await api("intake", {
        ...data, ...identity.current, source: leadSource(),
        publicQuote: bespoke
          ? { version: publicQuoteVersion, service }
          : { version: publicQuoteVersion, service, tier: displayedOffer.tier, options: selectedOptions },
        message: `${quoteSummary}\nConditions à confirmer dans une proposition adaptée avant tout paiement.${prospectContext ? `\nMaquette consultée : https://flex-web.fr/${prospectContext.slug}/` : ""}\n\nBesoin du client :\n${data.message}`,
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
      <p className="flow-eyebrow">{prospectContext ? "Votre maquette, votre prochain projet" : "Votre projet, étape par étape"}</p>
      <h1>{prospectContext ? <>Un pack pour<br />{prospectContext.name}.</> : <>{service === "automation" ? "Automatisez vos tâches." : service === "application" ? "Votre application sur mesure." : "Votre site internet."}<br />Commençons par votre besoin.</>}</h1>
      <p className="flow-intro">{prospectContext
        ? "Votre entreprise est déjà renseignée. Complétez vos coordonnées, puis confirmez votre pack et vos souhaits. Votre devis reste gratuit : aucun paiement à cette étape."
        : bespoke
        ? "Présentez votre activité, vos outils et ce que vous souhaitez améliorer. Nous préparons une proposition personnalisée avant tout engagement."
        : service === "automation" ? "Mettez en place votre CRM, vos automatisations et votre assistant IA interne pour 990 € TTC en paiement unique. Les outils, les usages et le périmètre sont confirmés au devis."
        : "Un site vitrine jusqu’à 5 pages à 299 € TTC, ou un site de 5 pages et plus avec SEO et IA à 590 € TTC. Paiement unique après validation du devis."}</p>
      <ol className={`flow-steps${prospectContext ? " flow-steps-short" : ""}`} aria-label="Étapes de la demande">
        {steps.map((s, i) => <li key={s} aria-current={step === i ? "step" : undefined}>{i + 1}. {s}</li>)}
      </ol>
      {prospectContext && <div className="flow-prospect-summary" role="status"><p>Votre demande concerne la maquette de <strong>{prospectContext.name}</strong>. Vous pouvez corriger les informations et préciser vos souhaits avant l’envoi.</p><p><strong>{packNames[displayedOffer.id] ? `Pack ${packNames[displayedOffer.id]}` : displayedOffer.name}</strong> · {bespoke ? "Sur devis" : `${money(displayedOffer.setupCents)} TTC en paiement unique`}{bespoke ? " · Budget et accompagnement à définir dans votre devis" : activeOptions.length ? ` · Options : ${money(activeOptions.reduce((total, option) => total + option.monthlyCents, 0))} TTC/mois` : " · Aucune option mensuelle sélectionnée"}.</p></div>}
      <div className="flow-columns">
        <form ref={form} onSubmit={step === finalStep ? submit : next} className="flow-card" aria-busy={busy}>
          <fieldset className="flow-fieldset" disabled={!ready || busy}>
            <h2 ref={heading} tabIndex={-1}>{prospectContext ? (step === 0 ? "Faisons connaissance" : "Votre pack, vos souhaits") : ["Faisons connaissance", bespoke ? "Votre prestation" : "Choisissez votre formule", "Ce que vous souhaitez accomplir"][step]}</h2>
            {step === 0 && <>
              <label htmlFor="quote-service">Votre projet</label><select id="quote-service" name="service" value={service} onChange={e => changeService(e.target.value)}>
                <option value="site">Créer un site internet et développer sa visibilité</option><option value="automation">Mettre en place un CRM et automatiser des tâches</option><option value="application">Développer une application</option>
              </select>
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
                {prospectContext && packNames[o.id] ? <><strong>Pack {packNames[o.id]}</strong><span className="flow-pack-name">{o.name}</span></> : o.name}
                <span className="flow-price">{o.setupCents ? `${money(o.setupCents)} TTC` : "Sur devis"}</span>
                <span className="flow-note">{o.setupCents ? "Forfait payé une seule fois. Options mensuelles facultatives." : "Proposition personnalisée après étude de votre besoin."}</span>
                {prospectContext && data.planId !== o.id
                  ? o.description && <span className="flow-note">{o.description}</span>
                  : <ul className="flow-list">{o.features.map((f) => <li key={f}>{f}</li>)}</ul>}
              </label>)}
              {!bespoke && <fieldset className="flow-fieldset">
                <legend>Options facultatives</legend>
                <p className="flow-note">Choisissez l’une, les deux ou aucune. Les interventions et limites seront précisées au devis.</p>
                {pricingOptions.map((option) => <label className="flow-offer" key={option.id}>
                  <input type="checkbox" name={option.id} checked={selectedOptions.includes(option.id)} onChange={(e) => setSelectedOptions((current) => e.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} />
                  {option.name} · +{money(option.monthlyCents)} TTC / mois
                  <span className="flow-note">{option.description}</span>
                </label>)}
              </fieldset>}
            </>}
            {step === finalStep && <>
              {prospectContext && <h3 className="flow-project-heading">Précisez votre projet</h3>}
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
              {prospectContext && <p className="flow-note">Et ensuite ? Nous préparons votre devis, vous validez son périmètre et ses conditions, puis vous accédez au paiement sécurisé. Votre maquette sera adaptée aux contenus que vous aurez approuvés.</p>}
            </>}
            {error && <p className="flow-error" role="alert">{error}</p>}
            <div className="flow-actions">
              {step > 0 && <button className="flow-button secondary" type="button" disabled={busy} onClick={() => { setStep((s) => s - 1); setError(""); }}>Retour</button>}
              <button className="flow-button" disabled={busy} type="submit">{busy ? "Enregistrement…" : step === finalStep ? "Recevoir mon devis" : "Continuer"}</button>
            </div>
          </fieldset>
        </form>
        <aside className="flow-aside">
          <p className="flow-eyebrow">Votre récapitulatif</p>
          <h2>{prospectContext && packNames[displayedOffer.id] ? `Pack ${packNames[displayedOffer.id]}` : displayedOffer.name}</h2>
          {prospectContext && packNames[displayedOffer.id] && <p className="flow-note">{displayedOffer.name}</p>}
          <p className="flow-price">{bespoke ? "Sur devis" : `${money(displayedOffer.setupCents)} TTC`}</p>
          <p className="flow-note">{bespoke ? "Le budget dépend des fonctionnalités, intégrations et outils nécessaires." : service === "automation" ? "Mise en place en paiement unique. Outils, licences et périmètre des automatisations précisés au devis." : "Création en paiement unique. Hébergement et nom de domaine précisés au devis."}</p>
          {!bespoke && (activeOptions.length ? <ul className="flow-list">{activeOptions.map((o) => <li key={o.id}>{o.name} : +{money(o.monthlyCents)} TTC / mois</li>)}</ul> : <p className="flow-note">Aucune option mensuelle sélectionnée.</p>)}
          {!bespoke && <div className="flow-total"><span>{service === "automation" ? "Mise en place du CRM" : "Création du site"}</span><strong>{money(displayedOffer.setupCents)} TTC</strong><span>Options mensuelles</span><strong>{money(activeOptions.reduce((total, option) => total + option.monthlyCents, 0))} TTC / mois</strong></div>}
          <p className="flow-note">Prix toutes taxes comprises. Le devis confirme les prestations et le total avant paiement.</p>
          <ul className="flow-list"><li>Un interlocuteur en Savoie</li><li>Un accompagnement partout en France</li><li>Un périmètre validé ensemble</li><li>Un espace privé pour suivre votre projet</li></ul>
          <p className="flow-note">Le calendrier est confirmé dans le devis selon le projet et les contenus disponibles.</p>
          <p className="flow-note"><a href="/pricing/">Revoir les tarifs et les prestations</a></p>
        </aside>
      </div>
    </>
  );
}
