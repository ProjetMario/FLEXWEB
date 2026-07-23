import { MotionWrapper } from "../utils/MotionWrapper.jsx";
import { Button } from "../ui/Button.jsx";

export default function CTA({ data = {} }) {
  const { label, title, description, button, buttonHref } = data;

  return (
    <section className="w-full bg-white py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <MotionWrapper type="scale-up" className="relative overflow-hidden rounded-[2rem] bg-[#f5f5f7] px-6 py-16 text-center sm:py-20 md:py-24" as="div">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <div className="relative z-10 mx-auto max-w-2xl">
            {label && <span className="mb-3 block text-xs font-semibold uppercase tracking-widest text-[#6e6e73]">{label}</span>}
            <h2 className="mb-4 text-4xl font-semibold tracking-[-0.04em] text-[#1d1d1f] sm:text-5xl">{title}</h2>
            {description && <p className="mb-8 text-base font-light text-[#6e6e73] sm:text-lg">{description}</p>}
            <Button href={buttonHref} variant="primary" className="bg-[#0071e3] text-white hover:bg-[#0077ed] shadow-none">
              {button}
            </Button>
          </div>
        </MotionWrapper>
      </div>
    </section>
  );
}
