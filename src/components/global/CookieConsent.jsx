import { useEffect, useState } from "react";

const consentKey = "flex-web-cookie-consent";

export default function CookieConsent({ lang = "fr", advertising = false }) {
  const messages = {
    fr: {aria:'Gestion des cookies',title:'Votre confidentialité',description:'Avec votre accord, Google Analytics mesure les visites et les demandes de devis pour améliorer le site. Les outils de mesure restent désactivés si vous refusez. Vous pouvez modifier votre choix en bas de page.',accept:'J’accepte',decline:'Je refuse',more:'En savoir plus'},
    en: {aria:'Cookie settings',title:'Your privacy',description:'With your agreement, Google Analytics measures visits and quote requests to improve this website. Measurement remains disabled if you decline. You can change your choice in the footer.',accept:'Accept',decline:'Decline',more:'Privacy policy (French)'},
    de: {aria:'Cookie-Einstellungen',title:'Ihre Privatsphäre',description:'Mit Ihrer Zustimmung misst Google Analytics Besuche und Offertanfragen zur Verbesserung der Website. Bei Ablehnung bleibt die Messung deaktiviert. Sie können Ihre Wahl unten auf der Seite ändern.',accept:'Akzeptieren',decline:'Ablehnen',more:'Datenschutz (Französisch)'},
    it: {aria:'Impostazioni cookie',title:'La tua privacy',description:'Con il tuo consenso, Google Analytics misura visite e richieste di preventivo per migliorare il sito. Se rifiuti, la misurazione resta disattivata. Puoi cambiare scelta in fondo alla pagina.',accept:'Accetta',decline:'Rifiuta',more:'Privacy (francese)'},
  };
  const copy = messages[lang] || messages.fr;
  const description = advertising
    ? 'Avec votre accord, Google Analytics mesure les visites et les demandes de devis, et le pixel OpenAI mesure les demandes de devis issues des publicités. Ces outils restent désactivés si vous refusez. Vous pouvez modifier votre choix en bas de page.'
    : copy.description;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!["accepted", "refused"].includes(window.localStorage.getItem(consentKey))
        || (advertising && !["accepted", "refused"].includes(window.localStorage.getItem('flex-web-openai-consent'))));
    }
    catch { setVisible(true); }
    const reopen = () => setVisible(true);
    window.addEventListener("flexweb-cookie-settings", reopen);
    return () => window.removeEventListener("flexweb-cookie-settings", reopen);
  }, [advertising]);

  const saveConsent = (value) => {
    try { window.localStorage.setItem(consentKey, value); } catch {}
    if (advertising || value === 'refused') {
      try { window.localStorage.setItem('flex-web-openai-consent', value); } catch {}
    }
    window.dispatchEvent(new CustomEvent("flexweb-consent-change", { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]" aria-label={copy.aria}>
      <h2 className="text-sm font-semibold text-[#1d1d1f]">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => saveConsent("accepted")} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white">{copy.accept}</button>
        <button type="button" onClick={() => saveConsent("refused")} className="rounded-full border border-[#d2d2d7] px-4 py-2 text-sm font-medium text-[#1d1d1f]">{copy.decline}</button>
        <a href="/privacy/" className="text-sm text-[#0071e3] hover:underline">{copy.more}</a>
      </div>
    </aside>
  );
}
