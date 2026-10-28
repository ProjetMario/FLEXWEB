import { Logo } from "./Logo.jsx";

export default function Footer({ data = {}, lang = "fr" }) {

  if (lang === "de" || lang === "it") {
    const de = lang === "de";
    return <footer className="border-t border-black/[0.08] bg-[#f5f5f7] py-12 text-sm text-[#424245]"><div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3"><div><Logo href="/" label={de ? "Flex-Web – Startseite (Französisch)" : "Flex-Web – Home (francese)"} className="h-14" /><p className="mt-4 leading-relaxed">Flex-Web · Fleximmo<br />Voglans · Savoie · France</p></div><nav aria-label={de ? "Dienstleistungen und Kontakt" : "Servizi e contatti"} className="flex flex-col gap-3"><a href="/creation-site-internet/" hrefLang="fr">{de ? "Websites (Französisch)" : "Siti web (francese)"}</a><a href="/creation-application-mobile/" hrefLang="fr">{de ? "Anwendungen (Französisch)" : "Applicazioni (francese)"}</a><a href="mailto:contact@flex-web.fr">contact@flex-web.fr</a><a href="/" hrefLang="fr">{de ? "Website auf Französisch" : "Sito in francese"}</a></nav><nav aria-label={de ? "Rechtliche Informationen" : "Informazioni legali"} className="flex flex-col gap-3"><a href="/privacy/" hrefLang="fr">{de ? "Datenschutz (Französisch)" : "Privacy (francese)"}</a><a href="/mentions-legales/" hrefLang="fr">{de ? "Impressum (Französisch)" : "Note legali (francese)"}</a><button type="button" className="text-left" onClick={() => window.dispatchEvent(new Event("flexweb-cookie-settings"))}>{de ? "Cookie-Einstellungen" : "Impostazioni cookie"}</button><span>© {new Date().getFullYear()} Flex-Web</span></nav></div></footer>;
  }
  if (lang === "en") return <footer className="border-t border-black/[0.08] bg-[#f5f5f7] py-12 text-sm text-[#424245]"><div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3"><div><Logo href="/en/" label="Flex-Web - Home" className="h-14" /><p className="mt-4 leading-relaxed">Websites, CRM and AI automation.<br />Flex-Web, a brand of Fleximmo.<br />Voglans · Savoie · France</p></div><nav aria-label="Services and contact" className="flex flex-col gap-3"><a href="/en/websites/">Website creation</a><a href="/en/applications/">Web and mobile applications</a><a href="/en/crm/">CRM and workflow automation</a><a href="/en/ai-automation/">AI automation</a><a href="/en/pricing/">Pricing</a><a href="/en/about/">About Flex-Web</a><a href="/en/contact/">Contact</a><a href="/" hrefLang="fr" lang="fr">Site en français</a></nav><nav aria-label="Legal information" className="flex flex-col gap-3"><a href="/privacy/">Privacy policy (French)</a><a href="/mentions-legales/">Legal notice (French)</a><a href="/cgv/">Terms of sale (French)</a><button type="button" className="text-left" onClick={() => window.dispatchEvent(new Event("flexweb-cookie-settings"))}>Cookie settings</button><span>© {new Date().getFullYear()} Flex-Web</span></nav></div></footer>;
  return (
    <footer
      className="w-full border-t border-black/[0.08] bg-[#f5f5f7] py-10 sm:py-14"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 gap-9 md:grid-cols-2 lg:grid-cols-5 lg:gap-10 mb-10">
          <div className="lg:col-span-2">
            <Logo className="h-14 md:h-[5.25rem]" />
            <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-[#6e6e73]">
              {data.description}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#6e6e73] mb-3">Services</div>
            <nav className="flex flex-col gap-2 text-sm text-[#424245]">
              <a href="/crm-automatisation-entreprise/" className="hover:text-[#0071e3] transition">CRM et automatisation</a>
              <a href="/automatisation-ia/" className="hover:text-[#0071e3] transition">Automatisation IA</a>
              <a href="/automatisation-ia-savoie/" className="hover:text-[#0071e3] transition">Automatisation en Savoie</a>
              <a href="/automatisation-ia-haute-savoie/" className="hover:text-[#0071e3] transition">Automatisation en Haute-Savoie</a>
              <a href="/creation-site-internet/" className="hover:text-[#0071e3] transition">Création de site internet</a>
              <a href="/creation-application-mobile/" className="hover:text-[#0071e3] transition">Application mobile</a>
              <a href="/creation-site-internet-savoie/" className="hover:text-[#0071e3] transition">Sites internet en Savoie</a>
              <a href="/creation-site-internet-haute-savoie/" className="hover:text-[#0071e3] transition">Sites internet en Haute-Savoie</a>
              <a href="/pricing/" className="hover:text-[#0071e3] transition">Tarifs</a>
            </nav>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#6e6e73] mb-3">Navigation</div>
            <nav className="flex flex-col gap-2 text-sm text-[#424245]">
              <a href="/#avantages" className="hover:text-[#0071e3] transition">Avantages</a>
              <a href="/#comment" className="hover:text-[#0071e3] transition">Comment ça marche</a>
              <a href="/#templates" className="hover:text-[#0071e3] transition">Exemples de scénarios</a>
              <a href="/ressources/" className="hover:text-[#0071e3] transition">Sites et automatisation : ressources</a>
              <a href="/journal/" className="hover:text-[#0071e3] transition">Guides pratiques</a>
              <a href="/realisations/" className="hover:text-[#0071e3] transition">Nos réalisations</a>
              <a href="/territoires/" className="hover:text-[#0071e3] transition">Projets par commune</a>
              <a href="/zones-intervention/" className="hover:text-[#0071e3] transition">Zones d’intervention</a>
              <a href="/about/" className="hover:text-[#0071e3] transition">À propos de Flex-Web</a>
              <a href="/#faq" className="hover:text-[#0071e3] transition">FAQ</a>
              <a href="/en/" hrefLang="en" lang="en" className="hover:text-[#0071e3] transition">English website</a>
              <a href="/#contact" className="hover:text-[#0071e3] transition">Contact</a>
            </nav>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#6e6e73] mb-3">Légal</div>
            <nav className="flex flex-col gap-2 text-sm text-[#424245]">
              <a href={data.privacyUrl} className="hover:text-[#0071e3] transition">{data.privacyLabel}</a>
              <a href={data.termsUrl} className="hover:text-[#0071e3] transition">{data.termsLabel}</a>
              <a href={data.cgvUrl} className="hover:text-[#0071e3] transition">{data.cgvLabel}</a>
              <button type="button" onClick={() => window.dispatchEvent(new Event("flexweb-cookie-settings"))} className="text-left hover:text-[#0071e3]">Choix des cookies</button>
            </nav>
            {data.socials && (
              <div className="mt-6 flex gap-4">
                {data.socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#6e6e73] hover:text-[#0071e3] transition">
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-black/[0.08] pt-7 text-xs text-[#86868b]">
          <span>© {new Date().getFullYear()} {data.brand}. Tous droits réservés.</span>
          <span>Voglans · Savoie · Haute-Savoie · France</span>
        </div>
      </div>
    </footer>
  );
}
