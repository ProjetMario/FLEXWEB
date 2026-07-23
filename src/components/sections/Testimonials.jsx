import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Star } from "lucide-react";

export default function Testimonials({ data = {} }) {
  const { label, items = [] } = data;

  return (
    <section id="temoignages" className="w-full bg-[#f5f5f7] py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <SectionHeader label={label} title={"Ce que disent nos clients"} align="center" />

        <MotionWrapper type="fade-up" isContainer className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {items.map((item, idx) => (
            <MotionChild key={idx}>
              <div className="h-full rounded-[1.5rem] bg-white p-7 sm:p-8 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(0,0,0,0.06)]">
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#1d1d1f] text-[#1d1d1f]" />
                  ))}
                </div>
                <p className="mb-7 text-base font-light leading-relaxed text-[#424245] sm:text-lg">“{item.quote}”</p>
                <div className="flex items-center gap-3">
                  <img src={item.avatar} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-semibold text-[#1d1d1f]">{item.name}</div>
                    <div className="text-xs font-light text-[#6e6e73]">{item.role}</div>
                  </div>
                </div>
              </div>
            </MotionChild>
          ))}
        </MotionWrapper>
      </div>
    </section>
  );
}
