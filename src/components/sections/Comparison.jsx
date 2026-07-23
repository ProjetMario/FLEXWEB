import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";
import { SectionHeader } from "../ui/SectionHeader.jsx";
import { Check, X, Minus } from "lucide-react";

function Cell({ value }) {
  const isPositive = typeof value === "string" && (value.includes("Inclus") || value.includes("1") || value.includes("24h") || value.includes("Optimisé") || value.includes("Simples"));
  const isNegative = value.includes("cachés") || value.includes("mois") || value.includes("À payer") || value.includes("Difficiles") || value.includes("Aucun");
  const icon = isPositive ? <Check className="h-4 w-4 text-emerald-600" /> : isNegative ? <X className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-[#6e6e73]" />;
  return (
    <div className="flex items-center gap-2 text-sm text-[#424245]">
      {icon} {value}
    </div>
  );
}

export default function Comparison({ data = {} }) {
  const { label, title, rows = [] } = data;

  return (
    <section className="w-full bg-[#f5f5f7] py-24 sm:py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <SectionHeader label={label} title={title} align="center" />

        <MotionWrapper type="fade-up" isContainer>
          <div className="overflow-x-auto rounded-[1.5rem] border border-black/[0.08] bg-white">
            <div className="grid min-w-[680px] grid-cols-4 bg-[#f5f5f7] text-xs font-semibold text-[#6e6e73]">
              <div className="p-4 border-b border-black/[0.08]">Critère</div>
              <div className="p-4 border-b border-black/[0.08] text-[#1d1d1f]">FLEX-WEB</div>
              <div className="p-4 border-b border-black/[0.08]">Seul</div>
              <div className="p-4 border-b border-black/[0.08]">Agence classique</div>
            </div>
            {rows.map((row, idx) => (
              <MotionChild key={idx} className={`grid min-w-[680px] grid-cols-4 text-sm ${idx % 2 === 0 ? "bg-white" : "bg-[#fbfbfd]"}`}>
                <div className="p-4 border-b border-black/[0.08] font-medium text-[#1d1d1f]">{row.feature}</div>
                <div className="p-4 border-b border-black/[0.08] bg-stone-50/80"><Cell value={row["flex-web"]} /></div>
                <div className="p-4 border-b border-black/[0.08]"><Cell value={row.alone} /></div>
                <div className="p-4 border-b border-black/[0.08]"><Cell value={row.agency} /></div>
              </MotionChild>
            ))}
          </div>
        </MotionWrapper>
      </div>
    </section>
  );
}
