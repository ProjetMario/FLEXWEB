import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";

export default function Stats({ data = [] }) {
  return (
    <section className="w-full max-w-8xl mx-auto px-4">
      <hr className="border-t border-gray-200" />
      <MotionWrapper type="fade-up" isContainer className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200">
        {data.map((stat) => (
          <MotionChild key={stat.label} className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <span className="text-3xl md:text-5xl font-light grotesque-font text-gray-900">
              {stat.value}
            </span>
            <span className="text-xs font-light text-gray-400 mt-2 uppercase tracking-widest">
              {stat.label}
            </span>
          </MotionChild>
        ))}
      </MotionWrapper>
      <hr className="border-t border-gray-200" />
    </section>
  );
}
