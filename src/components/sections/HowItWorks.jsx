import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";

export default function HowItWorks({ data = {} }) {
  const { label, title, items = [] } = data;

  return (
    <section id="comment" className="w-full bg-white py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <SectionHeader label={label} title={title} align="center" />

        <div className="relative">
          <div className="absolute left-7 top-0 bottom-0 hidden w-px bg-[#d2d2d7] md:block" />
          <MotionWrapper type="fade-up" isContainer className="relative grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-16 md:gap-y-12">
            {items.map((item, idx) => (
              <MotionChild key={idx}>
                <div className="flex gap-5">
                  <div className="flex-shrink-0">
                    <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-semibold text-white">
                      {item.number}
                    </div>
                  </div>
                  <div className="flex-1 border-b border-[#d2d2d7] pb-7 transition">
                    <h3 className="mb-2 text-lg font-semibold tracking-[-0.02em] text-[#1d1d1f]">{item.title}</h3>
                    <p className="text-sm font-light leading-relaxed text-[#6e6e73]">{item.description}</p>
                  </div>
                </div>
              </MotionChild>
            ))}
          </MotionWrapper>
        </div>
      </div>
    </section>
  );
}
