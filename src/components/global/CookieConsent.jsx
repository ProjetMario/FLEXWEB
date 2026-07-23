import { useEffect, useState } from "react";

const consentKey = "flex-web-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem(consentKey));
  }, []);

  const saveConsent = (value) => {
    window.localStorage.setItem(consentKey, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]" aria-label="Gestion des cookies">
      <h2 className="text-sm font-semibold text-[#1d1d1f]">Votre confidentialité</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
        Flex-Web utilise uniquement les cookies nécessaires au fonctionnement du site. Aucun cookie analytique ou marketing n'est activé sans votre choix.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => saveConsent("accepted")} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white">J'accepte</button>
        <button type="button" onClick={() => saveConsent("refused")} className="rounded-full border border-[#d2d2d7] px-4 py-2 text-sm font-medium text-[#1d1d1f]">Je refuse</button>
        <a href="/privacy" className="text-sm text-[#0071e3] hover:underline">En savoir plus</a>
      </div>
    </aside>
  );
}
