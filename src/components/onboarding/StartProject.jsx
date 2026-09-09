import { useEffect, useState, useRef } from "react";
import offers from "../../../apps/saas-platform/lib/automation/offers.json";
import { api, createIdentity, money, saveToken } from "./api";

export default function StartProject() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [data, setData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    businessType: "",
    planId: "croissance",
    message: "",
    timeline: "a-definir",
    privacyConsent: false,
    professional: false,
    websiteTrap: "",
    source: "site",
  });
  const form = useRef(null),
    identity = useRef(null),
    heading = useRef(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const plan = offers.some((o) => o.id === query.get("offre"))
      ? query.get("offre")
      : "croissance";
    setData((d) => ({
      ...d,
      planId: plan,
      source: (query.get("utm_source") || "site").slice(0, 160),
    }));
    try {
      identity.current = JSON.parse(
        sessionStorage.getItem("flexweb-intake") || "null",
      );
    } catch {
      identity.current = null;
    }
    setReady(true);
  }, []);
  const offer = offers.find((o) => o.id === data.planId);
  const set = (e) =>
    setData((d) => ({
      ...d,
      [e.target.name]:
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  function next(e) {
    e.preventDefault();
    if (!form.current.reportValidity()) return;
    setError("");
    setStep((s) => s + 1);
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!identity.current) identity.current = createIdentity();
      try {
        sessionStorage.setItem(
          "flexweb-intake",
          JSON.stringify(identity.current),
        );
      } catch {}
      await api("intake", { ...data, ...identity.current });
      saveToken(identity.current.accessToken);
      try {
        sessionStorage.removeItem("flexweb-intake");
      } catch {}
      window.location.assign(
        `/espace-projet/#cle=${identity.current.accessToken}`,
      );
    } catch (err) {
      setError(
        err.name === "TimeoutError"
          ? "La connexion a pris trop de temps. Réessayez : votre demande ne sera pas dupliquée."
          : err.message,
      );
      setBusy(false);
    }
  }
  const field = (name, label, type = "text", maxLength = 160) => (
    <label>
      {label}
      <input
        name={name}
        type={type}
        value={data[name]}
        onChange={set}
        required
        maxLength={maxLength}
        autoComplete={
          {
            contactName: "name",
            companyName: "organization",
            email: "email",
            phone: "tel",
            city: "address-level2",
          }[name] || "off"
        }
      />
    </label>
  );
  return (
    <>
      <p className="flow-eyebrow">Votre projet, étape par étape</p>
      <h1 ref={heading}>
        Un site qui travaille
        <br />
        pour votre activité.
      </h1>
      <p className="flow-intro">
        Présentez-nous votre entreprise et choisissez une formule. Nous
        vérifions ensemble le périmètre avant tout paiement.
      </p>
      <ol className="flow-steps" aria-label="Étapes de la demande">
        {["Votre activité", "Votre offre", "Votre projet"].map((s, i) => (
          <li key={s} aria-current={step === i ? "step" : undefined}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <div className="flow-columns">
        <form
          ref={form}
          onSubmit={step === 2 ? submit : next}
          className="flow-card"
          aria-busy={busy}
        >
          <fieldset className="flow-fieldset" disabled={!ready || busy}>
            <h2>
              {
                [
                  "Faisons connaissance",
                  "Choisissez votre formule",
                  "Ce que vous souhaitez accomplir",
                ][step]
              }
            </h2>
            {step === 0 && (
              <>
                <div className="flow-fields">
                  {field("companyName", "Entreprise")}
                  {field("contactName", "Votre nom")}
                  {field("email", "E-mail professionnel", "email", 254)}
                  {field("phone", "Téléphone", "tel", 25)}
                  {field("city", "Ville", "text", 100)}
                  {field("businessType", "Métier / activité", "text", 100)}
                </div>
                <label className="flow-check">
                  <input
                    name="professional"
                    type="checkbox"
                    checked={data.professional}
                    onChange={set}
                    required
                  />
                  Je fais cette demande pour mon activité professionnelle.
                </label>
              </>
            )}
            {step === 1 &&
              offers.map((o) => (
                <label className="flow-offer" key={o.id}>
                  <input
                    type="radio"
                    name="planId"
                    value={o.id}
                    checked={data.planId === o.id}
                    onChange={set}
                  />
                  {o.name}
                  {o.id === "croissance"
                    ? " · Avec suivi de votre activité"
                    : ""}
                  <span className="flow-note">À régler au démarrage</span>
                  <span className="flow-price">
                    {money(o.setupCents + o.monthlyCents)} HT
                  </span>
                  <span className="flow-note">
                    {o.monthlyCents
                      ? `${money(o.setupCents)} de création + ${money(o.monthlyCents)} pour le premier mois.`
                      : "Paiement unique pour le site vitrine prévu dans cette offre."}
                  </span>
                  <span className="flow-note">
                    {o.monthlyCents
                      ? `Puis ${money(o.monthlyCents)} HT par mois.`
                      : "Hébergement et maintenance en option."}
                  </span>
                  <ul className="flow-list">
                    {o.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </label>
              ))}
            {step === 2 && (
              <>
                <label>
                  Votre besoin
                  <textarea
                    name="message"
                    value={data.message}
                    onChange={set}
                    required
                    minLength={15}
                    maxLength={3000}
                    rows={5}
                    placeholder="Votre activité, vos clients et les demandes que vous souhaitez recevoir…"
                  />
                </label>
                <label>
                  Quand souhaitez-vous démarrer ?
                  <select name="timeline" value={data.timeline} onChange={set}>
                    <option value="a-definir">À définir ensemble</option>
                    <option value="rapidement">Dès que possible</option>
                    <option value="1-3-mois">Dans 1 à 3 mois</option>
                  </select>
                </label>
                <div hidden aria-hidden="true">
                  <label>
                    Votre deuxième site
                    <input
                      name="websiteTrap"
                      value={data.websiteTrap}
                      onChange={set}
                      autoComplete="off"
                      tabIndex={-1}
                    />
                  </label>
                </div>
                <label className="flow-check">
                  <input
                    name="privacyConsent"
                    type="checkbox"
                    checked={data.privacyConsent}
                    onChange={set}
                    required
                  />
                  <span>
                    J’accepte l’utilisation de mes informations pour traiter mon
                    projet et recevoir les messages nécessaires à son suivi.{" "}
                    <a href="/privacy/" target="_blank" rel="noreferrer">
                      Confidentialité
                    </a>
                    .
                  </span>
                </label>
                <p className="flow-note">
                  Cette demande est gratuite et ne vaut pas commande. Les
                  fonctionnalités et conditions sont confirmées avant paiement.
                </p>
              </>
            )}
            {error && (
              <p className="flow-error" role="alert">
                {error}
              </p>
            )}
            <div className="flow-actions">
              {step > 0 && (
                <button
                  className="flow-button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep((s) => s - 1);
                    setError("");
                  }}
                >
                  Retour
                </button>
              )}
              <button className="flow-button" disabled={busy} type="submit">
                {busy
                  ? "Enregistrement…"
                  : step === 2
                    ? "Créer mon espace projet"
                    : "Continuer"}
              </button>
            </div>
          </fieldset>
        </form>
        <aside className="flow-aside">
          <p className="flow-eyebrow">Votre sélection</p>
          <h2>{offer.name}</h2>
          <p className="flow-note">À régler au démarrage</p>
          <p className="flow-price">
            {money(offer.setupCents + offer.monthlyCents)} HT
          </p>
          {offer.monthlyCents > 0 ? (
            <>
              <p className="flow-note">
                {money(offer.setupCents)} de création +{" "}
                {money(offer.monthlyCents)} pour le premier mois.
              </p>
              <p>
                <strong>Puis {money(offer.monthlyCents)} HT par mois.</strong>
              </p>
              <p className="flow-note">La création est payée une seule fois.</p>
            </>
          ) : (
            <p className="flow-note">
              Paiement unique. Hébergement et maintenance en option.
            </p>
          )}
          <p className="flow-note">
            Prix hors taxes. Les taxes et le total seront indiqués avant le
            paiement.
          </p>
          <ul className="flow-list">
            <li>Un interlocuteur en Savoie</li>
            <li>Un périmètre validé ensemble</li>
            <li>Un espace privé pour votre brief</li>
            <li>Votre validation avant publication</li>
          </ul>
          <p className="flow-note">
            Livraison indicative : 24h à 7 jours ouvrés après validation du
            brief et réception des contenus.
          </p>
        </aside>
      </div>
    </>
  );
}
