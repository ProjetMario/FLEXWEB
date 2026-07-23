import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const variants = {
  "fade-up": {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  },
  "fade-in": {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.9, ease: "easeOut" } },
  },
  "slide-left": {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" } },
  },
  "slide-right": {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" } },
  },
  "scale-up": {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: "easeOut" } },
  },
  hero: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1.2, ease: "easeOut" } },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0 },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

export function MotionWrapper({ type = "fade-up", children, className = "", isContainer = false, as = "div" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const Component = motion[as] || motion.div;

  if (isContainer) {
    return (
      <Component
        ref={ref}
        className={className}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={containerVariants}
      >
        {children}
      </Component>
    );
  }

  const variant = variants[type] || variants["fade-up"];

  return (
    <Component
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variant}
    >
      {children}
    </Component>
  );
}

export function MotionChild({ children, className = "" }) {
  return (
    <motion.div className={className} variants={childVariants}>
      {children}
    </motion.div>
  );
}
