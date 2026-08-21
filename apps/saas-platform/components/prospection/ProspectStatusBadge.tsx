import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/prospection/status";
import type { ProspectionStatus } from "@prisma/client";

const variants: Record<ProspectionStatus, string> = {
  NOUVEAU: "bg-slate-100 text-slate-700 ring-slate-600/20",
  A_CONTACTER: "bg-blue-50 text-blue-700 ring-blue-700/20",
  SMS_ENVOYE: "bg-sky-50 text-sky-700 ring-sky-700/20",
  SANS_REPONSE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  REPONDU: "bg-indigo-50 text-indigo-700 ring-indigo-700/20",
  INTERESSE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  A_RELANCER: "bg-orange-50 text-orange-700 ring-orange-600/20",
  RDV_PLANIFIE: "bg-teal-50 text-teal-700 ring-teal-600/20",
  RDV_EFFECTUE: "bg-green-50 text-green-700 ring-green-600/20",
  DEVIS_ENVOYE: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  NEGOCIATION: "bg-violet-50 text-violet-700 ring-violet-600/20",
  CLIENT_SIGNE: "bg-green-100 text-green-800 ring-green-600/30",
  PAS_INTERESSE: "bg-red-50 text-red-700 ring-red-600/20",
  A_RECONTACTER_PLUS_TARD: "bg-zinc-100 text-zinc-700 ring-zinc-600/20",
  PERDU: "bg-neutral-100 text-neutral-700 ring-neutral-600/20",
};

export function ProspectStatusBadge({ status }: { status: ProspectionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
