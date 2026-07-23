import { motion } from "framer-motion";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Button } from "../ui/Button.jsx";

export default function Contact({ data = {} }) {
  const { label, title, description, details = [] } = data;

  return (
    <section id="contact" className="w-full bg-[#f5f5f7] py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-24">
          <div>
            <SectionHeader label={label} title={title} className="mb-0" />
            <p className="mt-5 max-w-md text-base font-light leading-relaxed text-[#6e6e73]">{description}</p>
            <div className="mt-10 flex flex-col gap-5">
              {details.map((d, idx) => (
                <div key={idx}>
                  <div className="text-xs font-semibold text-[#6e6e73]">{d.label}</div>
                  <div className="text-sm text-[#1d1d1f]">{d.value}</div>
                </div>
              ))}
            </div>
          </div>

          <motion.form initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} method="POST" action="https://formsubmit.co/bonjour@flex-web.fr" className="rounded-[1.5rem] bg-white p-6 sm:p-8 shadow-[0_14px_36px_rgba(0,0,0,0.05)]">
            <input type="hidden" name="_subject" value="Nouvelle demande de devis FLEX-WEB" />
            <input type="hidden" name="_next" value="https://flex-web.fr/#contact" />
            <input type="hidden" name="_captcha" value="false" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="name" className="text-xs font-medium text-[#6e6e73]">Nom</label>
                <input id="name" name="name" required className="rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] transition focus:border-[#0071e3] focus:outline-none" placeholder="Votre nom" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="company" className="text-xs font-medium text-[#6e6e73]">Entreprise</label>
                <input id="company" name="company" className="rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] transition focus:border-[#0071e3] focus:outline-none" placeholder="Votre entreprise" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="phone" className="text-xs font-medium text-[#6e6e73]">Téléphone</label>
                <input id="phone" name="phone" type="tel" className="rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] transition focus:border-[#0071e3] focus:outline-none" placeholder="06 12 34 56 78" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-xs font-medium text-[#6e6e73]">Email</label>
                <input id="email" name="email" type="email" required className="rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] transition focus:border-[#0071e3] focus:outline-none" placeholder="vous@exemple.fr" />
              </div>
            </div>
            <div className="flex flex-col gap-1 mb-4">
              <label htmlFor="message" className="text-xs font-medium text-[#6e6e73]">Message</label>
              <textarea id="message" name="message" required rows={5} className="resize-none rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] transition focus:border-[#0071e3] focus:outline-none" placeholder="Parlez-nous de votre projet..." />
            </div>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-[#6e6e73]">
              <input type="checkbox" name="privacy_consent" required className="mt-0.5" />
              <span>J'accepte que Fleximmo utilise mes données pour répondre à ma demande. <a href="/privacy" className="text-[#0071e3] hover:underline">Voir la politique de confidentialité</a>.</span>
            </label>
            <Button type="submit" variant="primary" className="mt-4 w-full">
              Envoyer ma demande
            </Button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
