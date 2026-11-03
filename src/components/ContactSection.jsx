import { motion } from "framer-motion";
import { MotionWrapper } from "./utils/MotionWrapper.jsx";

export default function ContactSection({ data = {} }) {
  const { label, title, description, details = [] } = data;
  const projects = [
    { label: "Site internet", subject: "Projet de site internet", service: "site", guide: "/creation-site-internet/", quote: "/demarrer/?service=site" },
    { label: "Application sur mesure", subject: "Projet d’application web, mobile ou ordinateur", service: "application", guide: "/creation-application-mobile/", quote: "/demarrer/?service=application" },
    { label: "CRM et automatisation", subject: "Projet CRM ou automatisation", service: "automation", guide: "/crm-automatisation-entreprise/", quote: "/demarrer/?service=automation" },
  ];

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
                  {d.href ? <a className="text-sm font-light text-blue-700 underline underline-offset-4" href={d.href} data-conversion-event={d.event} data-conversion-service="unknown">{d.value}</a> : <span className="text-sm font-light text-gray-800">{d.value}</span>}
                </div>
              ))}
            </div>
          )}
        </MotionWrapper>

        <motion.div initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} className="flex flex-col items-start gap-5 rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="text-2xl font-semibold text-gray-900">Quel projet souhaitez-vous préparer ?</h2>
          <p className="text-gray-600 leading-relaxed">Entreprise ou particulier, contactez-nous par e-mail ou téléphone. Indiquez votre besoin, votre pays et les contenus ou outils déjà disponibles. Le périmètre, le prix et le calendrier sont confirmés au devis avant tout paiement.</p>
          <a href="mailto:contact@flex-web.fr?subject=Mon%20projet%20avec%20Flex-Web" data-conversion-event="email_click" data-conversion-service="unknown" className="rounded-full bg-blue-600 px-7 py-3 font-medium text-white hover:bg-blue-700">Décrire mon projet par e-mail</a>
          <ul className="w-full space-y-5">
            {projects.map(project => <li key={project.service} className="border-t border-gray-200 pt-5">
              <h3 className="font-semibold text-gray-900">{project.label}</h3>
              <p className="mt-2 text-sm leading-relaxed"><a href={`mailto:contact@flex-web.fr?subject=${encodeURIComponent(project.subject)}`} className="text-blue-700 underline" data-conversion-event="email_click" data-conversion-service={project.service}>Écrire à propos de ce projet</a> · <a href={project.guide} className="text-blue-700 underline">Comprendre la prestation</a></p>
              <p className="mt-2 text-sm leading-relaxed"><a href={project.quote} className="text-blue-700 underline" data-conversion-event="quote_click" data-conversion-service={project.service}>Formulaire de devis professionnel</a></p>
            </li>)}
          </ul>
        </motion.div>
      </div>
      <div className="mt-12 max-w-3xl space-y-4 text-sm leading-relaxed text-gray-600">
        <h2 className="text-2xl font-semibold text-gray-900">Des échanges en français ou en anglais</h2>
        <p>Flex-Web est une marque de Fleximmo, basée à Voglans en Savoie. Nous accompagnons les entreprises et les particuliers en France et en Suisse. Pour les autres pays francophones, nous étudions les conditions d’un projet à distance avec vous avant accord.</p>
        <p><a href="/francophonie/" className="text-blue-700 underline">Organiser un projet à distance</a> · <a href="/creation-site-internet-pas-cher/" className="text-blue-700 underline">Préparer un site avec un petit budget</a> · <a href="/realisations/" className="text-blue-700 underline">Explorer les réalisations</a></p>
      </div>
    </section>
  );
}
