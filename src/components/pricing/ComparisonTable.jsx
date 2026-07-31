import { Check, Minus, X } from "lucide-react";
import { motion } from "framer-motion";

const planMeta = [
  { key: "essential", name: "Essentielle", bg: "bg-[#fbfbfd]", border: "border-black/[0.08]" },
  { key: "professional", name: "Professionnelle", bg: "bg-[#f5f5f7]", border: "border-black/[0.08]", featured: true },
  { key: "ownership", name: "Achat définitif", bg: "bg-white", border: "border-black/[0.08]" },
];

function Value({ value }) {
  if (value === true) return <Check className="h-4 w-4 text-[#1d1d1f]" aria-label="Inclus" />;
  if (value === false) return <X className="h-4 w-4 text-[#d2d2d7]" aria-label="Non inclus" />;
  if (value === "Optionnelle" || value === "Optionnel") return <span className="text-xs text-[#6e6e73]">{value}</span>;
  return <span className="text-xs font-medium text-[#424245]">{value}</span>;
}

/**
 * Responsive comparison table for the three pricing paths.
 * Desktop: table. Mobile: stacked plan cards.
 */
export default function ComparisonTable({ rows = [] }) {
  return (
    <>
      {/* Desktop table */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="hidden overflow-x-auto rounded-[1.5rem] border border-black/[0.08] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)] md:block"
      >
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Comparaison des offres FLEX-WEB</caption>
          <thead>
            <tr className="border-b border-black/[0.08] bg-[#f5f5f7] text-xs font-semibold text-[#6e6e73]">
              <th className="px-5 py-5 sm:px-7">Fonctionnalité</th>
              <th className="bg-[#fbfbfd] px-5 py-5 text-center text-[#1d1d1f] sm:px-7">Essentielle</th>
              <th className="bg-[#e8e8ed] px-5 py-5 text-center text-[#1d1d1f] sm:px-7">Professionnelle</th>
              <th className="px-5 py-5 text-center sm:px-7">Achat définitif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className={index % 2 ? "bg-[#fbfbfd]" : "bg-white"}>
                <th scope="row" className="border-b border-black/[0.08] px-5 py-4 text-sm font-medium text-[#1d1d1f] sm:px-7">{row.label}</th>
                <td className="border-b border-black/[0.08] bg-[#fbfbfd] px-5 py-4 text-center sm:px-7"><Value value={row.essential} /></td>
                <td className="border-b border-black/[0.08] bg-[#f5f5f7] px-5 py-4 text-center sm:px-7"><Value value={row.professional} /></td>
                <td className="border-b border-black/[0.08] px-5 py-4 text-center sm:px-7"><Value value={row.ownership} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t border-black/[0.08] px-5 py-4 text-xs text-[#6e6e73] sm:px-7">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" /> Les éléments indiqués comme optionnels peuvent être ajoutés selon vos besoins.
        </div>
      </motion.div>

      {/* Mobile cards */}
      <div className="grid gap-4 md:hidden">
        {planMeta.map((plan, pIndex) => (
          <motion.div
            key={plan.key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: pIndex * 0.1 }}
            className={`rounded-2xl border ${plan.border} ${plan.bg} p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]`}
          >
            <h3 className="mb-4 text-center text-base font-semibold text-[#1d1d1f]">
              {plan.name}
              {plan.featured && <span className="ml-2 text-xs font-normal text-[#0071e3]">Recommandé</span>}
            </h3>
            <dl className="space-y-3">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 border-b border-black/[0.06] pb-3 last:border-0 last:pb-0">
                  <dt className="text-sm text-[#6e6e73]">{row.label}</dt>
                  <dd className="flex min-w-[5rem] justify-end">
                    <Value value={row[plan.key]} />
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        ))}
        <p className="flex items-center gap-2 text-xs text-[#6e6e73]">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" /> Les éléments optionnels sont ajoutables sur demande.
        </p>
      </div>
    </>
  );
}
