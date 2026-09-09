import { ChevronDown } from "lucide-react";

/** @param {{ items?: import("../../data/pricing").PricingFaqItem[] }} props */
export default function PricingFAQ({ items = [] }) {
  return (
    <div className="mx-auto max-w-3xl border-y border-black/10">
      {items.map((item, index) => (
        <details
          key={item.question}
          name="pricing-questions"
          open={index === 0}
          className="group border-b border-black/10 last:border-b-0"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left text-sm font-semibold text-[#1d1d1f] hover:text-[#0071e3] focus-visible:outline-2 focus-visible:outline-[#0071e3] sm:px-6 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-[#6e6e73] transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="px-5 pb-5 text-sm leading-relaxed text-[#52525b] sm:px-6">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
