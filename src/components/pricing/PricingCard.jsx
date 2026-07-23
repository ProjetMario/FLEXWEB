import { Check, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Premium pricing card shared by all FLEX-WEB offers.
 */
export default function PricingCard({ plan }) {
  return (
    <motion.article
      whileHover={{ y: plan.featured ? -8 : -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`relative flex h-full flex-col rounded-3xl border p-6 sm:p-8 ${
        plan.featured
          ? "z-10 border-[#1d1d1f] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.10)] lg:-my-4 lg:p-10"
          : "border-black/[0.08] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            {plan.featured && <Sparkles className="h-4 w-4 text-[#0071e3]" aria-hidden="true" />}
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#1d1d1f]">{plan.name}</h3>
          </div>
          <p className="max-w-xs text-sm font-light leading-relaxed text-[#6e6e73]">{plan.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ${plan.featured ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#6e6e73]"}`}>
          {plan.badge}
        </span>
      </div>

      <div className="mb-8 border-b border-black/[0.08] pb-8">
        <div className="text-4xl font-semibold tracking-[-0.045em] text-[#1d1d1f] sm:text-5xl">{plan.price}</div>
        <div className="mt-2 text-xs font-medium text-[#6e6e73]">{plan.priceNote}</div>
      </div>

      <ul className="mb-8 flex flex-1 flex-col gap-3" aria-label={`Inclus dans ${plan.name}`}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[#424245]">
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${plan.featured ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#424245]"}`}>
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {plan.maintenance && (
        <div className="mb-8 rounded-2xl bg-[#f5f5f7] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#1d1d1f]">Maintenance optionnelle</span>
            <span className="text-sm font-semibold text-[#1d1d1f]">{plan.maintenance.price}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6e6e73]">{plan.maintenance.features.join(" · ")}</p>
        </div>
      )}

      <a href={plan.href} className={`group inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${plan.featured ? "bg-[#0071e3] text-white hover:bg-[#0077ed]" : "border border-[#d2d2d7] bg-white text-[#1d1d1f] hover:border-[#86868b] hover:bg-[#fbfbfd]"}`}>
        {plan.cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </a>
    </motion.article>
  );
}
