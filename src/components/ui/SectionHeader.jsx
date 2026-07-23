import { MotionWrapper } from "../utils/MotionWrapper.jsx";

/**
 * Reusable section header with label and title.
 */
export function SectionHeader({ label, title, align = "left", className = "" }) {
  const alignClass = align === "center" ? "text-center mx-auto" : "";

  return (
    <MotionWrapper type="fade-up" className={`max-w-4xl mb-12 md:mb-20 ${alignClass} ${className}`}> 
      {label && (
        <span className="block text-sm font-medium text-[#6e6e73] mb-3">
          {label}
        </span>
      )}
      {title && (
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-[-0.04em] text-[#1d1d1f] leading-[1.08]">
          {title}
        </h2>
      )}
    </MotionWrapper>
  );
}
