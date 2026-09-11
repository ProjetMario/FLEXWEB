import { Check, ArrowRight } from "lucide-react";

/** @param {{ plan: import("../../data/pricing").PricingPlan }} props */
export default function PricingCard({ plan }) {
  return (
    <article
      id={`offre-${plan.id}`}
      className={`flex h-full min-w-0 flex-col rounded-3xl border bg-white p-6 sm:p-7 ${plan.featured ? "border-[#0071e3]/40 shadow-[0_8px_32px_rgba(0,113,227,0.07)]" : "border-black/10"}`}
    >
      <header className="mb-6 min-h-24">
        <h3 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
          {plan.name}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#52525b]">
          {plan.description}
        </p>
      </header>
      <div className="rounded-2xl bg-[#f5f5f7] p-5">
        <p className="text-sm font-medium text-[#424245]">
          À régler au démarrage
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[#1d1d1f]">
          <strong className="whitespace-nowrap text-4xl font-semibold tracking-tight">
            {plan.firstPayment}
          </strong>
          <span className="text-sm">HT</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#52525b]">
          {plan.setupPrice} de création
          <br />+ {plan.monthlyPrice} pour le premier mois
        </p>
        <div className="mt-4 border-t border-black/10 pt-4">
          <p className="text-sm text-[#424245]">Puis, chaque mois</p>
          <p className="mt-1 text-2xl font-semibold text-[#1d1d1f]">
            {plan.monthlyPrice}{" "}
            <span className="ml-1 text-sm font-normal">HT / mois</span>
          </p>
        </div>
      </div>
      <h4 className="mb-4 mt-6 text-sm font-semibold text-[#1d1d1f]">
        Ce qui est inclus
      </h4>
      <ul
        className="mb-7 flex flex-1 flex-col gap-3"
        aria-label={`Inclus dans ${plan.name}`}
      >
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-sm leading-relaxed text-[#424245]"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-[#0071e3]"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <a
        href={plan.href}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0071e3] ${plan.featured ? "bg-[#0071e3] text-white hover:bg-[#0065cc]" : "bg-[#1d1d1f] text-white hover:bg-[#424245]"}`}
      >
        Demander un devis {plan.name}
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
    </article>
  );
}
