import { MotionWrapper } from "./utils/MotionWrapper.jsx";

export default function Title({ title }) {
  return (
    <section className="w-full max-w-8xl mx-auto px-4 pt-8 pb-4 grid grid-cols-1 md:grid-cols-1 items-center">
      <MotionWrapper type="fade-up" className="text-4xl md:text-6xl font-light text-right grotesque-font leading-tight" as="h1">
        {title}
      </MotionWrapper>
    </section>
  );
}
