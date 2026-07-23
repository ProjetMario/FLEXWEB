/**
 * Flexweb wordmark with a geometric FX monogram icon.
 * Designed to feel at home alongside Apple-style interfaces.
 */
export function Logo({ className = "h-6" }) {
  return (
    <a href="/" className={`inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 rounded-md ${className}`} aria-label="Flexweb - Accueil">
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="fxGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0071e3" />
            <stop offset="100%" stopColor="#00c6ff" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill="url(#fxGrad)" />
        <path
          d="M10.5 11h11v2.8h-8v4.4h6v2.8h-6v8.8h-3V11z"
          fill="white"
        />
        <path
          d="M21.5 11h2.9l3.7 6.1 3.7-6.1h2.9l-5.4 8.7 5.4 8.7h-2.9l-3.7-6.1-3.7 6.1h-2.9l5.4-8.7L21.5 11z"
          fill="white"
        />
      </svg>
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
        Flexweb
      </span>
    </a>
  );
}
