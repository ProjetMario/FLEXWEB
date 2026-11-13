import { useEffect, useState, useRef } from "react";
import { websiteOffers, automationOffers, publicQuoteVersion } from "../../data/pricing.ts";
import { leadSource } from "../../lib/acquisition.ts";
import { trackConversionEvent } from "../../lib/analytics.ts";
import { trackLead } from "../../lib/quote-analytics.ts";
import { quoteNeedMaxLength, buildQuoteMessage } from "../../lib/declared-source.mjs";
import { isProspectSlug, validProspectContext } from "../../lib/prospect-context.mjs";
import { api, createIdentity, money, saveToken } from "./api";

import "../../styles/quote-form.css";

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
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [service, setService] = useState("site");
  const [sitePlan, setSitePlan] = useState("essentielle");
  const [automationPlan, setAutomationPlan] = useState("crm-automation");
  const selectedOptions = [];
  const declaredSource = "";
  const [prospectContext, setProspectContext] = useState(null);
  const [data, setData] = useState({
    companyName: "", contactName: "", email: "", phone: "", city: "", businessType: "",
    planId: "essentielle", message: "", timeline: "a-definir", privacyConsent: false,
    professional: "", websiteTrap: "", source: "site",
  });
  const form = useRef(null), identity = useRef(null);
  const formStarted = useRef(false);
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
  const displayedOffer = offerChoices.find((o) => o.id === data.planId) || offerChoices[0];
  const bespoke = !displayedOffer.setupCents;
  const quoteSummary = bespoke
    ? `Demande de devis : ${displayedOffer.name}. Budget et périmètre à chiffrer, aucun forfait site sélectionné.`
    : `Demande de devis : ${displayedOffer.name}, ${money(displayedOffer.setupCents)} TTC en paiement unique. Options demandées : aucune mensualité.`;
  const messageContext = { summary: quoteSummary, prospectSlug: prospectContext?.slug, declaredSource };
  const maxNeedLength = quoteNeedMaxLength(messageContext);
  const startForm = (event) => {
    // Refusal or a not-yet-ready analytics loader must not consume the event.
    // A later input after consent can record the start, once for this journey.
    const chosenService = event.target.name === "service" && ["site", "automation", "application"].includes(event.target.value) ? event.target.value : service;
    if (!formStarted.current && trackConversionEvent("form_start", chosenService)) formStarted.current = true;
  };
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
  async function submit(e) {
    e.preventDefault();
    if (busy || !form.current.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      if (!identity.current) identity.current = createIdentity();
      try { sessionStorage.setItem("flexweb-intake-v2", JSON.stringify(identity.current)); } catch {}
      const message = buildQuoteMessage(messageContext, data.message);
      await api("intake", {
        ...data, ...identity.current, professional: data.professional === "pro", source: leadSource(),
        publicQuote: bespoke
          ? { version: publicQuoteVersion, service }
          : { version: publicQuoteVersion, service, tier: displayedOffer.tier, options: selectedOptions },
        message,
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
  return (
    <section className="quote-simple">
      <p className="flow-eyebrow">Pro & particuliers</p>
      <h1>Votre devis gratuit.</h1>
      <p className="flow-intro">Décrivez votre projet en quelques mots. Sans engagement.</p>
      {prospectContext && <p className="quote-context">Votre demande concerne la maquette de <strong>{prospectContext.name}</strong>.</p>}
      <form ref={form} onInputCapture={startForm} onSubmit={submit} className="flow-card" aria-busy={busy}>
        <fieldset className="flow-fieldset" disabled={!ready || busy}>
          <fieldset className="quote-profile">
            <legend>Vous êtes</legend>
            <label><input type="radio" name="professional" value="pro" checked={data.professional === "pro"} onChange={set} required />Pro</label>
            <label><input type="radio" name="professional" value="particulier" checked={data.professional === "particulier"} onChange={set} required />Particulier</label>
          </fieldset>
          <div className="flow-fields">
            <label>Votre nom<input name="contactName" value={data.contactName} onChange={set} required maxLength={120} autoComplete="name" /></label>
            <label>Votre e-mail<input name="email" type="email" value={data.email} onChange={set} required maxLength={254} autoComplete="email" /></label>
          </div>
          <label>Votre besoin<textarea name="message" value={data.message} onChange={set} required minLength={15} maxLength={maxNeedLength} rows={3} placeholder="Un site, une application, une tâche à automatiser… Dites-nous ce que vous souhaitez." /></label>
          <label>Téléphone <span className="quote-optional">(facultatif)</span><input name="phone" type="tel" value={data.phone} onChange={set} maxLength={25} autoComplete="tel" /></label>
          <details className="quote-details">
            <summary>Précisions et offre <span className="quote-optional">(facultatif)</span></summary>
            <label>Entreprise ou organisation <span className="quote-optional">(facultatif)</span><input name="companyName" value={data.companyName} onChange={set} maxLength={160} autoComplete="organization" /></label>
            <label>Type de projet<select name="service" value={service} onChange={e => changeService(e.target.value)}>
              <option value="site">Site internet</option><option value="automation">CRM et automatisation</option><option value="application">Application web ou mobile</option>
            </select></label>
            <label>Offre envisagée<select name="planId" value={data.planId} onChange={set}>
              {offerChoices.map(o => <option key={o.id} value={o.id}>{o.name}{o.setupCents ? ` — ${money(o.setupCents)} TTC` : " — Sur devis"}</option>)}
            </select></label>
            <p className="flow-note">Le devis confirme les prestations et le prix avant tout paiement. Aucune option mensuelle ajoutée.</p>
          </details>
          <div hidden aria-hidden="true"><label>Votre deuxième site<input name="websiteTrap" value={data.websiteTrap} onChange={set} autoComplete="off" tabIndex={-1} /></label></div>
          <label className="flow-check quote-consent"><input name="privacyConsent" type="checkbox" checked={data.privacyConsent} onChange={set} required /><span>J’accepte d’être recontacté pour cette demande. <a href="/privacy/" target="_blank" rel="noreferrer">Confidentialité</a>.</span></label>
          {error && <p className="flow-error" role="alert">{error}</p>}
          <button className="flow-button quote-submit" disabled={busy} type="submit">{busy ? "Envoi en cours…" : "Recevoir mon devis"}</button>
          <p className="flow-note quote-reassurance">Gratuit et sans engagement. Aucun paiement à cette étape.</p>
        </fieldset>
      </form>
    </section>
  );
}
