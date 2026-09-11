import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo.jsx";

export default function Navigation({ data = {} }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null), menu = useRef(null);
  const { links = [] } = data;
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu.current?.querySelector("a")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); toggle.current?.focus(); }
      if (e.key !== "Tab") return;
      const focusables = [toggle.current, ...menu.current.querySelectorAll("a")].filter(Boolean);
      const first = focusables[0], last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const wide = matchMedia("(min-width: 1024px)");
    const onWide = () => { if (wide.matches) setOpen(false); };
    document.addEventListener("keydown", onKey); wide.addEventListener("change", onWide);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); wide.removeEventListener("change", onWide); };
  }, [open]);
  const href = (link) => link.href.startsWith("#") ? `/${link.href}` : link.href;
  return <header className="site-navigation sticky top-0 z-40 border-b border-black/[0.07] bg-white/95 backdrop-blur-xl">
    <nav aria-label="Navigation principale" className="relative mx-auto flex h-[76px] max-w-[1200px] items-center justify-between gap-4 px-[18px] md:px-7">
      <Logo className="h-12 shrink-0" />
      <div className="hidden items-center gap-6 text-[13px] font-medium text-[#424245] lg:flex">{links.map(link => <a key={link.href} href={href(link)} className="py-3 hover:text-[#0071e3]">{link.label}</a>)}</div>
      <div className="flex items-center gap-3"><a href="/demarrer/" className="inline-flex min-h-11 items-center rounded-full bg-[#0071e3] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#0062c4] sm:px-5 sm:text-[13px]">Demander un devis</a><button ref={toggle} type="button" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white lg:hidden"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 7h14M3 13h14" />}</svg></button></div>
    </nav>
    {open && <div id="mobile-navigation" ref={menu} className="fixed inset-x-0 top-[76px] h-[calc(100dvh-76px)] overflow-y-auto bg-white px-7 pb-10 pt-7 lg:hidden"><div className="mx-auto flex max-w-xl flex-col">{links.map(link => <a key={link.href} href={href(link)} onClick={() => setOpen(false)} className="border-b border-black/[0.07] py-5 text-2xl font-medium tracking-tight">{link.label}</a>)}<p className="mt-10 text-sm text-[#6e6e73]">Un projet en Savoie, Haute-Savoie ou ailleurs en France.</p><a href="/demarrer/" className="mt-5 self-start rounded-full bg-[#0071e3] px-6 py-3.5 text-sm text-white" onClick={() => setOpen(false)}>Demander mon devis ↗</a></div></div>}
  </header>;
}
