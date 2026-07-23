import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";

export default function Features({ data = {} }) {
  const { label, title, items = [] } = data;

  return (
    <section className="w-full max-w-8xl mx-auto px-4 py-16">
      <hr className="mb-6 border-t border-gray-200" />
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
        {label && (
          <span className="text-xs text-gray-400 uppercase tracking-widest font-light">
            {label}
          </span>
        )}
        {title && (
          <h2 className="text-3xl md:text-4xl font-light grotesque-font text-gray-900 md:text-right">
            {title}
          </h2>
        )}
      </div>
      <MotionWrapper type="fade-up" isContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {items.map((item, idx) => (
          <MotionChild key={idx} className="flex flex-col gap-3 border-t border-gray-200 pt-6 pb-10 pr-8">
            <span className="text-xs text-gray-300 font-light grotesque-font tabular-nums">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <h3 className="text-sm font-light text-gray-900 grotesque-font">{item.title}</h3>
            <p className="text-sm font-light text-gray-400 leading-relaxed">{item.description}</p>
          </MotionChild>
        ))}
      </MotionWrapper>
    </section>
  );
}
