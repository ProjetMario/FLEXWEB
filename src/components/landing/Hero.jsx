import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const videoSrc = "/videos/hero.mov";

export default function Hero() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="relative w-full max-w-8xl mx-auto overflow-hidden"
    >
      <video
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-auto object-cover"
      />
    </motion.section>
  );
}
