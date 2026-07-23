import { ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Conversion banner at the end of the pricing page.
 */
export default function PricingCTA() {
  return (
    <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} className="relative overflow-hidden rounded-[2rem] bg-[#f5f5f7] px-6 py-14 text-center sm:px-10 sm:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#1d1d1f] text-white">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-4xl font-semibold tracking-[-0.04em] text-[#1d1d1f] sm:text-5xl">Besoin d'aide pour choisir ?</h2>
        <p className="mx-auto mt-4 max-w-lg text-base font-light leading-relaxed text-[#6e6e73]">Nous vous conseillons gratuitement afin de choisir la formule la plus adaptée à votre activité.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/#contact" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0077ed]">
            Demander un devis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </a>
          <a href="/#templates" className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-[#0071e3] transition hover:underline hover:underline-offset-4">
            Voir des réalisations
          </a>
        </div>
      </div>
    </motion.section>
  );
}
