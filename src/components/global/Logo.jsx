/**
 * Flexweb logo image.
 */
export function Logo({ className = "h-6" }) {
  return (
    <a href="/" className={`inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 rounded-md ${className}`} aria-label="Flexweb - Accueil">
      <img src="/logo.png" alt="Flexweb" className="h-full w-auto" />
    </a>
  );
}
