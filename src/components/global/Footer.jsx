import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Logo } from "./Logo.jsx";

export default function Footer({ data = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.footer
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="w-full border-t border-black/[0.08] bg-[#f5f5f7] py-10 sm:py-14"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 gap-9 md:grid-cols-2 lg:grid-cols-4 lg:gap-12 mb-10">
          <div className="lg:col-span-2">
            <Logo className="h-10" />
            <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-[#6e6e73]">
              {data.description}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#6e6e73] mb-3">Navigation</div>
            <nav className="flex flex-col gap-2 text-sm text-[#424245]">
              <a href="/#avantages" className="hover:text-[#0071e3] transition">Avantages</a>
              <a href="/#comment" className="hover:text-[#0071e3] transition">Comment ça marche</a>
              <a href="/#templates" className="hover:text-[#0071e3] transition">Templates</a>
              <a href="/#temoignages" className="hover:text-[#0071e3] transition">Témoignages</a>
              <a href="/#faq" className="hover:text-[#0071e3] transition">FAQ</a>
              <a href="/#contact" className="hover:text-[#0071e3] transition">Contact</a>
            </nav>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#6e6e73] mb-3">Légal</div>
            <nav className="flex flex-col gap-2 text-sm text-[#424245]">
              <a href={data.privacyUrl} className="hover:text-[#0071e3] transition">{data.privacyLabel}</a>
              <a href={data.termsUrl} className="hover:text-[#0071e3] transition">{data.termsLabel}</a>
              <a href={data.cgvUrl} className="hover:text-[#0071e3] transition">{data.cgvLabel}</a>
            </nav>
            {data.socials && (
              <div className="mt-6 flex gap-4">
                {data.socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#6e6e73] hover:text-[#0071e3] transition">
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-black/[0.08] pt-7 text-xs text-[#86868b]">
          <span>© {new Date().getFullYear()} {data.brand}. Tous droits réservés.</span>
          <span>Conçu avec Astro, React et Tailwind CSS.</span>
        </div>
      </div>
    </motion.footer>
  );
}
