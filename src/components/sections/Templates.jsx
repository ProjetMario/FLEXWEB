import { useState } from "react";
import { motion } from "framer-motion";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Button } from "../ui/Button.jsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Templates({ data = {} }) {
  const { label, title, items = [] } = data;
  const [index, setIndex] = useState(0);
  const visible = 3;
  const maxIndex = Math.max(0, items.length - visible);

  const next = () => setIndex((i) => Math.min(i + 1, maxIndex));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  return (
    <section id="templates" className="w-full overflow-hidden bg-white py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <SectionHeader label={label} title={title} className="mb-0" />
          <div className="flex gap-2">
            <button onClick={prev} disabled={index === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d2d2d7] bg-white text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-30">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} disabled={index === maxIndex} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d2d2d7] bg-white text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-30">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <motion.div
          animate={{ x: `-${index * (100 / visible)}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex gap-5"
        >
          {items.map((item) => (
            <div key={item.id} className="w-full sm:w-1/2 lg:w-1/3 flex-shrink-0">
              <div className="group overflow-hidden rounded-[1.5rem] bg-[#f5f5f7] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,0,0,0.08)]">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e8e8ed]">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="p-6">
                  <h3 className="mb-1 text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">{item.title}</h3>
                  <p className="mb-4 text-sm font-light text-[#6e6e73]">{item.description}</p>
                  <Button href="#contact" variant="secondary" className="w-full py-2.5">Aperçu</Button>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
