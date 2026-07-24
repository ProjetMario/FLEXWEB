import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Play, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react";

const slides = [
  { src: "/images/showcase/foot-nation.jpg", alt: "foot-nation.com", title: "Foot Nation", url: "https://www.foot-nation.com" },
  { src: "/images/showcase/2savoie-immo.jpg", alt: "2savoie.immo", title: "2Savoie Immo", url: "https://www.2savoie.immo" },
  { src: "/images/showcase/serrurier73.jpg", alt: "serrurier73.fr", title: "Serrurier 73", url: "https://serrurier73.fr" },
  { src: "/images/showcase/agencevoglans.jpg", alt: "agencevoglans.fr", title: "L'Agence de Voglans", url: "https://www.agencevoglans.fr" }
];

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative overflow-hidden bg-white" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#f5f5f7] via-white to-transparent" />

      <motion.div className="relative mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-6 sm:pt-40 md:pb-32 md:pt-48">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div className="z-10 flex flex-col gap-7">
            <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-sm font-medium text-[#6e6e73]">
              Sites web livrés en 1 à 2 semaines
            </motion.span>

            <motion.h1 id="hero-title" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }} className="text-5xl font-semibold tracking-[-0.055em] text-[#1d1d1f] leading-[1.04] sm:text-6xl lg:text-7xl">
              Votre site web professionnel, <span className="text-[#6e6e73]">sans prise de tête.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.16 }} className="max-w-lg text-lg font-light leading-relaxed text-[#6e6e73] sm:text-xl">
              Nous créons un site moderne, rapide et optimisé pour développer votre activité. Hébergement, maintenance et support inclus.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.24 }} className="flex flex-col items-start gap-4 sm:flex-row">
              <a href="#contact" className="group inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0077ed]">
                Demander un devis <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </a>
              <a href="#templates" className="group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-[#0071e3] transition hover:underline hover:underline-offset-4">
                <Play className="h-4 w-4 fill-current" /> Voir une démo
              </a>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.65, delay: 0.4 }} className="text-sm text-[#86868b]">
              Déjà plus de 500 entrepreneurs et PME accompagnés.
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.2 }} className="relative z-10">
            <div className="relative rounded-[2rem] border border-black/[0.06] bg-white p-2 shadow-[0_24px_64px_rgba(0,0,0,0.10)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.65rem] bg-[#f5f5f7]">
                <button
                  type="button"
                  onClick={() => setPreviewIndex(current)}
                  className='group absolute inset-0 z-10 cursor-pointer overflow-hidden rounded-[1.65rem]'
                  aria-label={"Voir l'aperçu de " + slides[current].title}
                >
                  <motion.img
                    key={current}
                    src={slides[current].src}
                    alt={slides[current].title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className='h-full w-full object-cover transition-transform duration-700 group-hover:scale-105'
                  />
                  <div className='absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10'>
                    <span className='rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-[#1d1d1f] opacity-0 shadow-sm transition group-hover:opacity-100'>
                      Voir l'aperçu
                    </span>
                  </div>
                </button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.06)] backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setCurrent((c) => (c - 1 + slides.length) % slides.length)}
                  className="rounded-full p-1 text-[#424245] transition hover:bg-[#f5f5f7]"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrent(i)}
                      className={`h-1.5 w-1.5 rounded-full transition ${i === current ? "bg-[#0071e3]" : "bg-[#d2d2d7]"}`}
                      aria-label={`Aller à l'image ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrent((c) => (c + 1) % slides.length)}
                  className="rounded-full p-1 text-[#424245] transition hover:bg-[#f5f5f7]"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 -z-10 h-40 w-40 rounded-full bg-[#d2d2d7]/40 blur-3xl" />
          </motion.div>
        </div>
      </motion.div>
    {previewIndex !== null && (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm' onClick={() => setPreviewIndex(null)}>
        <div className='relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl' onClick={(e) => e.stopPropagation()}>
          <div className='flex items-center justify-between border-b border-black/[0.06] px-5 py-3'>
            <span className='text-sm font-semibold text-[#1d1d1f]'>{slides[previewIndex].title}</span>
            <button
              type='button'
              onClick={() => setPreviewIndex(null)}
              className='rounded-full p-2 text-[#424245] transition hover:bg-[#f5f5f7]'
              aria-label="Fermer l'aperçu"
            >
              <X className='h-5 w-5' />
            </button>
          </div>
          <div className='flex-1 overflow-auto bg-[#f5f5f7] p-4'>
            <img
              src={slides[previewIndex].src}
              alt={slides[previewIndex].title}
              className='mx-auto h-auto max-h-[70vh] w-full rounded-xl object-contain'
            />
          </div>
          <div className='border-t border-black/[0.06] px-5 py-3'>
            <a
              href={slides[previewIndex].url}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0077ed]'
            >
              Visiter le site <ExternalLink className='h-4 w-4' />
            </a>
          </div>
        </div>
      </div>
    )}
    </section>
  );
}
