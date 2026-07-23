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
        scrolled ? "bg-white/72 border-b border-black/[0.08] backdrop-blur-2xl" : "bg-transparent"
      }`
    : "sticky top-0 z-40 w-full bg-white/72 border-b border-black/[0.08] backdrop-blur-2xl";

  return (
    <nav className={navClass}>
      <div className="mx-auto flex max-w-6xl flex-row items-center justify-between px-5 py-3.5 md:px-7 relative">
        <Logo className="h-10" />

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-6 text-xs font-medium text-[#424245]">
          {links.map((link) => (
            <a key={link.href} href={link.href.startsWith("#") ? `/${link.href}` : link.href} className="transition hover:text-[#0071e3]">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <a
            href="/#contact"
            className="inline-flex items-center rounded-full bg-[#0071e3] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#0077ed]"
          >
            Devis gratuit
          </a>
        </div>

        {!open && (
          <button
            className="flex flex-col cursor-pointer justify-center items-center space-y-1.5 md:hidden focus:outline-none"
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(true)}
          >
            <span className="block w-6 h-0.5 bg-stone-700" />
            <span className="block w-6 h-0.5 bg-stone-700" />
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col px-6 pt-5 md:hidden">
          <div className="flex flex-row justify-between items-center py-2 mb-10">
            <div onClick={() => setOpen(false)}>
              <Logo className="h-10" />
            </div>
            <button
              className="text-2xl cursor-pointer font-light text-stone-500 leading-none"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
            >
              &times;
            </button>
          </div>
          <nav className="flex flex-col">
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
              href="/#contact"
              onClick={() => setOpen(false)}
              className="mt-8 inline-flex items-center justify-center rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white"
            >
              Devis gratuit
            </a>
          </nav>
        </div>
      )}
    </nav>
  );
}
