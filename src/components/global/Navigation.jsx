import { useState, useEffect } from "react";
import { Logo } from "./Logo.jsx";

export default function Navigation({ data = {}, transparent = false }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { links = [] } = data;

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const navClass = transparent
    ? `fixed top-0 left-0 right-0 z-40 w-full transition-colors duration-300 ${
        scrolled
          ? "bg-[#f5f5f7]/90 md:bg-[#f5f5f7]/85 border-b border-black/[0.08] md:backdrop-blur-2xl"
          : "bg-white md:bg-[#f5f5f7]/50 border-b border-black/[0.08] md:border-transparent"
      }`
    : "sticky top-0 z-40 w-full bg-[#f5f5f7]/90 border-b border-black/[0.08] md:backdrop-blur-2xl";

  return (
    <nav className={navClass}>
      <div className="mx-auto flex max-w-6xl flex-row items-center justify-between px-5 py-3.5 md:px-7 relative">
        <Logo className="h-14 md:h-[5.25rem]" />

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center gap-6 text-sm font-medium text-[#424245]">
          {links.map((link) => (
            <a key={link.href} href={link.href.startsWith("#") ? `/${link.href}` : link.href} className="transition-colors duration-200 hover:text-[#0071e3]">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center">
          <a
            href="/demarrer/?service=automation"
            className="inline-flex items-center rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
          >
            Devis gratuit
          </a>
        </div>

        {!open && (
          <button
            className="flex flex-col cursor-pointer justify-center items-center space-y-1.5 lg:hidden focus:outline-none"
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(true)}
          >
            <span className="block w-6 h-0.5 bg-stone-700" />
            <span className="block w-6 h-0.5 bg-stone-700" />
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-2xl flex flex-col px-6 pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-row justify-between items-center border-b border-stone-100 py-4 mb-6">
              <div onClick={() => setOpen(false)}>
                <Logo className="h-14 md:h-[5.25rem]" />
              </div>
              <button
                className="text-2xl cursor-pointer font-light text-stone-500 leading-none"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
              >
                &times;
              </button>
            </div>
            <nav className="flex flex-col overflow-y-auto">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href.startsWith("#") ? `/${link.href}` : link.href}
                  onClick={() => setOpen(false)}
                  className="text-2xl font-medium text-stone-900 py-4 border-b border-stone-100 hover:text-stone-500 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/demarrer/?service=automation"
                onClick={() => setOpen(false)}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white"
              >
                Devis gratuit
              </a>
            </nav>
          </div>
        </div>
      )}
    </nav>
  );
}
