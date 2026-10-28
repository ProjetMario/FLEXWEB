/**
 * Flexweb logo image.
 */
export function Logo({ className = "h-6", href = "/", label = "Flexweb - Accueil" }) {
  return (
    <a href={href} className={`inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 rounded-md ${className}`} aria-label={label}>
      <img src="/logo.png" alt="Flexweb" className="h-full w-auto" />
    </a>
  );
}
