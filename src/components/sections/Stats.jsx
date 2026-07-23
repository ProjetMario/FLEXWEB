import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";

function Counter({ value, inView }) {
  const numeric = parseInt(value.replace(/\D/g, ""), 10) || 0;
  const suffix = value.replace(/[0-9]/g, "");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const stepTime = Math.max(16, Math.floor(duration / numeric));
    const timer = setInterval(() => {
      start += 1;
      setCount(Math.min(start, numeric));
      if (start >= numeric) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [inView, numeric]);

  return (
    <span className="tabular-nums">
      {count}
      {suffix}
    </span>
  );
}

export default function Stats({ data = [] }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="w-full border-y border-black/[0.08] bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:gap-4">
          {data.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: idx * 0.1 }}
              className="text-center md:border-r md:border-black/[0.08] md:last:border-r-0"
            >
              <div className="mb-2 text-4xl font-semibold tracking-[-0.045em] text-[#1d1d1f] sm:text-5xl md:text-6xl">
                <Counter value={stat.value} inView={inView} />
              </div>
              <div className="text-xs font-medium text-[#6e6e73] sm:text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
