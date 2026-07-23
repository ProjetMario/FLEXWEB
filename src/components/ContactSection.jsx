import { motion } from "framer-motion";
import { MotionWrapper } from "./utils/MotionWrapper.jsx";

export default function ContactSection({ data = {} }) {
  const { label, title, description, details = [] } = data;

  return (
    <section className="w-full max-w-8xl mx-auto px-4 py-16">
      <hr className="mb-6 border-t border-gray-200" />
      {label && (
        <span className="text-xs text-gray-400 uppercase tracking-widest font-light">
          {label}
        </span>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-10">
        <MotionWrapper type="fade-up" className="flex flex-col gap-6">
          {title && (
            <h1 className="text-4xl md:text-5xl font-light grotesque-font text-gray-900 leading-tight">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-sm font-light text-gray-500 leading-relaxed max-w-sm">
              {description}
            </p>
          )}
          {details.length > 0 && (
            <div className="flex flex-col gap-4 mt-4">
              {details.map((d, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 uppercase tracking-widest font-light">{d.label}</span>
                  <span className="text-sm font-light text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </MotionWrapper>

        <motion.form initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} method="POST" action="https://formsubmit.co/bonjour@flex-web.fr" className="flex flex-col gap-4">
          <input type="hidden" name="_subject" value="Nouvelle demande de devis FLEX-WEB" />
          <input type="hidden" name="_next" value="https://flex-web.fr/contact" />
          <input type="hidden" name="_captcha" value="false" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-xs text-gray-400 font-light uppercase tracking-widest">Nom</label>
              <input id="name" type="text" name="name" required className="px-4 py-3 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-gray-400 bg-transparent" placeholder="Votre nom" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="company" className="text-xs text-gray-400 font-light uppercase tracking-widest">Entreprise</label>
              <input id="company" type="text" name="company" className="px-4 py-3 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-gray-400 bg-transparent" placeholder="Votre entreprise" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-xs text-gray-400 font-light uppercase tracking-widest">Téléphone</label>
              <input id="phone" type="tel" name="phone" className="px-4 py-3 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-gray-400 bg-transparent" placeholder="06 12 34 56 78" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-xs text-gray-400 font-light uppercase tracking-widest">Email</label>
              <input id="email" type="email" name="email" required className="px-4 py-3 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-gray-400 bg-transparent" placeholder="vous@exemple.fr" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-xs text-gray-400 font-light uppercase tracking-widest">Message</label>
            <textarea id="message" name="message" required rows={5} className="px-4 py-3 border border-gray-200 rounded text-sm font-light focus:outline-none focus:border-gray-400 bg-transparent resize-none" placeholder="Parlez-nous de votre projet..." />
          </div>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
            <input type="checkbox" name="privacy_consent" required className="mt-0.5" />
            <span>J'accepte que Fleximmo utilise mes données pour répondre à ma demande. <a href="/privacy" className="text-blue-600 hover:underline">Voir la politique de confidentialité</a>.</span>
          </label>
          <button type="submit" className="self-start px-8 py-3 bg-gray-900 text-white text-sm font-light rounded hover:bg-gray-700 transition">
            Envoyer ma demande
          </button>
        </motion.form>
      </div>
    </section>
  );
}
