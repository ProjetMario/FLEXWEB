import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";

export default function Testimonials({ data = {} }) {
  const { label, items = [] } = data;

  return (
    <section className="w-full max-w-8xl mx-auto px-4 py-16">
      <hr className="mb-6 border-t border-gray-200" />
      {label && (
        <span className="text-xs text-gray-400 uppercase tracking-widest font-light">
          {label}
        </span>
      )}
      <MotionWrapper type="fade-up" isContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
        {items.map((item, idx) => (
          <MotionChild key={idx} className="flex flex-col justify-between gap-6 border border-gray-100 p-8 rounded-xl">
            <p className="text-base font-light text-gray-700 leading-relaxed grotesque-font">
              &ldquo;{item.quote}&rdquo;
            </p>
            <div className="flex flex-col gap-0.5 border-t border-gray-100 pt-4">
              <span className="text-sm font-light text-gray-900">{item.name}</span>
              <span className="text-xs font-light text-gray-400">{item.role}</span>
            </div>
          </MotionChild>
        ))}
      </MotionWrapper>
    </section>
  );
}
