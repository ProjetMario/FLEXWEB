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

        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} className="flex flex-col items-start gap-5 rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="text-2xl font-semibold text-gray-900">Parlons de votre prochain site</h2>
          <p className="text-gray-600 leading-relaxed">Décrivez votre activité, choisissez votre formule et retrouvez le suivi dans votre espace privé. Nous confirmons le périmètre avant tout paiement.</p>
          <a href="/demarrer/" className="rounded-full bg-blue-600 px-7 py-3 font-medium text-white hover:bg-blue-700">Préparer mon projet</a>
          <p className="text-sm leading-relaxed text-gray-500">Pour une application sur mesure ou une question, écrivez-nous à <a href="mailto:contact@flex-web.fr" className="text-blue-600 underline">contact@flex-web.fr</a>.</p>
        </motion.div>
      </div>
    </section>
  );
}
