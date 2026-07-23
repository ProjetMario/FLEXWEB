/**
 * Minimal FLEX-WEB wordmark with a geometric monogram icon.
 * Designed to feel at home alongside Apple-style interfaces.
 */
export function Logo({ className = "h-6" }) {
  return (
    <a href="/" className={`inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 rounded-md ${className}`} aria-label="FLEX-WEB - Accueil">
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="12" fill="#1d1d1f" />
        <path
          d="M12 14h10M12 20h7M12 26h10"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M27 16c-2.5 0-3.5 2-3.5 4s1 4 3.5 4c-2.5 0-3.5 2-3.5 4"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
        FLEX-WEB
      </span>
    </a>
  );
}
