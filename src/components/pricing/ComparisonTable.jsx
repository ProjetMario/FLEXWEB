import { Check, Minus, X } from "lucide-react";
import { motion } from "framer-motion";

function Value({ value }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-[#1d1d1f]" aria-label="Inclus" />;
  if (value === false) return <X className="mx-auto h-4 w-4 text-[#d2d2d7]" aria-label="Non inclus" />;
  if (value === "Optionnelle" || value === "Optionnel") return <span className="text-xs text-[#6e6e73]">{value}</span>;
  return <span className="text-xs font-medium text-[#424245]">{value}</span>;
}

/**
 * Responsive comparison table for the three pricing paths.
 */
export default function ComparisonTable({ rows = [] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} className="overflow-x-auto rounded-[1.5rem] border border-black/[0.08] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
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
  );
}
