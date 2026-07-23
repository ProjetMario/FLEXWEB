import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * Accessible accordion for pricing questions.
 */
export default function PricingFAQ({ items = [] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mx-auto max-w-3xl border-y border-black/[0.08]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `pricing-faq-panel-${index}`;
        return (
          <div key={item.question} className="overflow-hidden border-b border-black/[0.08] last:border-b-0">
            <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenIndex(isOpen ? -1 : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-sm font-semibold text-[#1d1d1f] transition hover:text-[#0071e3] sm:px-6">
              {item.question}
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#6e6e73] transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div id={panelId} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                  <p className="px-5 pb-5 pr-10 text-sm font-light leading-relaxed text-[#6e6e73] sm:px-6">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
