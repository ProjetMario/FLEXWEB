import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Plus, Minus } from "lucide-react";

export default function FAQ({ data = {} }) {
  const { label, title, items = [] } = data;
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="w-full bg-white py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-3xl px-5 sm:px-6 md:px-8">
        <SectionHeader label={label} title={title} align="center" />

        <div className="border-y border-black/[0.08]">
          {items.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <div key={idx} className="overflow-hidden border-b border-black/[0.08] last:border-b-0">
                <button
                  onClick={() => setOpen(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between py-5 text-left transition hover:text-[#0071e3]"
                  aria-expanded={isOpen}
                >
                  <span className="pr-4 text-base font-semibold tracking-[-0.02em] text-[#1d1d1f]">{item.question}</span>
                  <span className="flex-shrink-0 text-[#6e6e73]">
                    {isOpen ? <Minus className="h-4 w-4 text-[#6e6e73]" /> : <Plus className="h-4 w-4 text-[#6e6e73]" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="max-w-2xl pb-5 pr-10 text-sm font-light leading-relaxed text-[#6e6e73]">{item.answer}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
