import { useEffect, useState } from "react";

const consentKey = "flex-web-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { setVisible(!["accepted", "refused"].includes(window.localStorage.getItem(consentKey))); }
    catch { setVisible(true); }
    const reopen = () => setVisible(true);
    window.addEventListener("flexweb-cookie-settings", reopen);
    return () => window.removeEventListener("flexweb-cookie-settings", reopen);
  }, []);

  const saveConsent = (value) => {
    try { window.localStorage.setItem(consentKey, value); } catch {}
    window.dispatchEvent(new CustomEvent("flexweb-consent-change", { detail: value }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]" aria-label="Gestion des cookies">
      <h2 className="text-sm font-semibold text-[#1d1d1f]">Votre confidentialité</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
        Avec votre accord, Google Analytics mesure les visites et les demandes de devis pour améliorer le site. Les outils de mesure restent désactivés si vous refusez. Vous pouvez modifier votre choix en bas de page.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => saveConsent("accepted")} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white">J'accepte</button>
        <button type="button" onClick={() => saveConsent("refused")} className="rounded-full border border-[#d2d2d7] px-4 py-2 text-sm font-medium text-[#1d1d1f]">Je refuse</button>
        <a href="/privacy/" className="text-sm text-[#0071e3] hover:underline">En savoir plus</a>
      </div>
    </aside>
  );
}
