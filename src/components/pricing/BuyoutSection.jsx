import { LockKeyholeOpen, Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Explains FLEX-WEB's decreasing buyout price and ownership promise.
 */
export default function BuyoutSection({ tiers = [] }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#1d1d1f] px-6 py-12 text-white shadow-[0_20px_48px_rgba(0,0,0,0.14)] sm:px-10 sm:py-16 lg:px-16">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />

      <div className="relative grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }}>
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white">
            <LockKeyholeOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mb-3 text-sm font-medium text-[#a1a1a6]">Rachat du site</p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Vous êtes libre de partir quand vous le souhaitez.</h2>
          <p className="mt-5 max-w-lg text-base font-light leading-relaxed text-[#d2d2d7]">Chez FLEX-WEB, vous n'êtes jamais bloqué. Si un jour vous souhaitez arrêter votre abonnement, vous pouvez continuer à utiliser FLEX-WEB ou racheter définitivement votre site.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7, delay: 0.1 }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiers.map((tier) => (
              <div key={tier.label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:-translate-y-1 hover:bg-white/[0.12]">
                <div className="text-xs leading-relaxed text-[#a1a1a6]">{tier.label}</div>
                <div className="mt-3 text-2xl font-semibold text-white">{tier.price}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.08] p-5">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#f5f5f7]">Vos contenus (textes, images, logo, documents) restent toujours votre propriété. Lors du rachat, nous vous remettons une version autonome de votre site.</p>
            </div>
            <p className="mt-3 pl-8 text-xs leading-relaxed text-[#a1a1a6]">Les services FLEX-WEB — hébergement, maintenance, mises à jour et support — prennent alors fin.</p>
          </div>
          <a href="/#contact" className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-white transition hover:text-[#d2d2d7]">
            Parlons de votre projet <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
