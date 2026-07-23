import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Icon } from "../ui/Icon.jsx";

export default function Benefits({ data = {} }) {
  const { label, title, items = [] } = data;

  return (
    <section id="avantages" className="w-full bg-[#f5f5f7] py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <SectionHeader label={label} title={title} align="center" />

        <MotionWrapper type="fade-up" isContainer className="grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] border border-black/[0.08] bg-black/[0.08] sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, idx) => (
            <MotionChild key={idx}>
              <div className="group h-full bg-white p-7 transition duration-300 hover:bg-[#fbfbfd]">
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1d1d1f] text-white transition duration-300 group-hover:scale-105">
                  <Icon name={item.icon} className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold tracking-[-0.02em] text-[#1d1d1f]">{item.title}</h3>
                <p className="text-sm font-light leading-relaxed text-[#6e6e73]">{item.description}</p>
              </div>
            </MotionChild>
          ))}
        </MotionWrapper>
      </div>
    </section>
  );
}
