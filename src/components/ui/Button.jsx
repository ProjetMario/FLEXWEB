import { ArrowRight } from "lucide-react";

/**
 * Reusable button component with primary and secondary variants.
 */
export function Button({
  href,
  type = "button",
  variant = "primary",
  children,
  className = "",
  showArrow = false,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2";
  const styles =
    variant === "primary"
      ? "bg-[#0071e3] text-white shadow-sm hover:bg-[#0077ed] hover:shadow-md"
      : "bg-transparent text-[#0071e3] hover:underline hover:underline-offset-4";

  const content = (
    <>
      {children}
      {showArrow && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
    </>
  );

  if (href) {
    return (
      <a href={href} className={`${base} ${styles} ${className}`}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} className={`${base} ${styles} ${className}`}>
      {content}
    </button>
  );
}
