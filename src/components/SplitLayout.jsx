import { useState, useEffect } from "react";
import SplitLayoutSkeleton from "./SplitLayoutSkeleton.jsx";
import { MotionWrapper } from "./utils/MotionWrapper.jsx";

function AccordionItem({ service, isOpen, onToggle }) {
  return (
    <div className="border-b grotesque-font border-gray-200">
      <button
        className="w-full cursor-pointer flex justify-between items-center py-4 text-left focus:outline-none"
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="text-md font-light grotesque-font">{service.title}</span>
        <span className="text-2xl text-gray-400">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="text-gray-600 pb-4 pr-4">
          {Array.isArray(service.content) ? (
            <div>
              {service.content.map((item, i) => (
                <p key={i} className="font-light grotesque-font">- {item}</p>
              ))}
            </div>
          ) : (
            <p className="font-light">{service.content}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SplitLayout({ data = {} }) {
  const [mounted, setMounted] = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <SplitLayoutSkeleton />;

  const {
    heading = "",
    services = [],
    image = { src: "/images/about-photo.jpg", alt: "Journal cover" },
    title = "",
    description = "",
  } = data;

  const toggle = (idx) => setActiveIdx(activeIdx === idx ? null : idx);

  const headingEl = heading
    ? <h1 className="text-4xl font-light grotesque-font mb-6" dangerouslySetInnerHTML={{ __html: heading }} />
    : <h1 className="text-4xl font-light grotesque-font mb-6">{title}</h1>;

  const headingMobile = heading
    ? <h1 className="text-3xl font-light grotesque-font mb-4 block md:hidden" dangerouslySetInnerHTML={{ __html: heading }} />
    : <h1 className="text-3xl font-light grotesque-font mb-4 block md:hidden">{title}</h1>;

  return (
    <section className="min-h-screen flex items-center justify-center">
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <MotionWrapper type="slide-left" className="hidden md:flex flex-col p-8 justify-between" isContainer={false}>
          <div>
            {headingEl}
            <div>
              {services.map((service, idx) => (
                <AccordionItem
                  key={idx}
                  service={service}
                  isOpen={activeIdx === idx}
                  onToggle={() => toggle(idx)}
                />
              ))}
            </div>
          </div>
        </MotionWrapper>

        <MotionWrapper type="slide-right" className="flex flex-col md:h-[750px] px-4 md:px-0 w-full">
          {headingMobile}
          <img
            loading="lazy"
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover rounded-2xl md:rounded-2xl"
            style={{ objectPosition: "center" }}
          />
          <div className="py-4 border-t border-gray-200 text-xs block md:hidden">
            <div className="text-gray-500">{description}</div>
          </div>
          <div className="block md:hidden">
            {services.map((service, idx) => (
              <AccordionItem
                key={idx}
                service={service}
                isOpen={activeIdx === idx}
                onToggle={() => toggle(idx)}
              />
            ))}
          </div>
          <div className="hidden md:flex flex-col md:flex-row gap-2 py-4 border-gray-200 text-xs">
            <div className="text-gray-500">{description}</div>
          </div>
        </MotionWrapper>
      </div>
    </section>
  );
}
