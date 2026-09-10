import { STATUS_LABELS } from "@/lib/prospection/status";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import {
  Calendar,
  MessageSquare,
  CheckCircle,
  Phone,
  Mail,
  FileText,
  UserCheck,
  StickyNote,
  RotateCcw,
} from "lucide-react";
import type {
  ProspectInteraction,
  FollowUp,
  ProspectNote,
} from "@prisma/client";
import type { ProspectionStatus } from "@prisma/client";

const icons: Record<string, typeof MessageSquare> = {
  PROSPECT_AJOUTE: CheckCircle,
  SMS_ENVOYE: MessageSquare,
  REPONSE_RECUE: CheckCircle,
  APPEL: Phone,
  EMAIL: Mail,
  NOTE: StickyNote,
  RELANCE: RotateCcw,
  RDV: Calendar,
  DEVIS: FileText,
  CLIENT_SIGNE: UserCheck,
  STATUT_MODIFIE: CheckCircle,
};

export function ProspectTimeline({
  prospect,
  interactions,
  followUps,
  notes,
}: {
  prospect: {
    internalNotes: string | null;
    createdAt: Date;
    firstSmsSentAt: Date | null;
    lastInteractionAt: Date | null;
    nextFollowUpAt: Date | null;
    status: ProspectionStatus;
  };
  interactions: ProspectInteraction[];
  followUps: FollowUp[];
  notes: ProspectNote[];
}) {
  const timelineItems = [
    {
      id: "created",
      date: prospect.createdAt,
      type: "PROSPECT_AJOUTE",
      title: "Prospect ajouté",
      note: "",
    },
    ...(prospect.firstSmsSentAt
      ? [
          {
            id: "first-sms",
            date: prospect.firstSmsSentAt,
            type: "SMS_ENVOYE" as const,
            title: "Premier SMS envoyé",
            note: "",
          },
        ]
      : []),
    ...interactions.map((i) => ({
      id: i.id,
      date: i.createdAt,
      type: i.type,
      title:
        i.type === "STATUT_MODIFIE" && i.newStatus ? (
          <span className="flex items-center gap-2">
            Statut modifié{" "}
            {i.oldStatus ? `de ${STATUS_LABELS[i.oldStatus]}` : ""}
            <ProspectStatusBadge status={i.newStatus} />
          </span>
        ) : (
          i.type.replace("_", " ").toLowerCase()
        ),
      note: i.note || "",
    })),
    ...followUps.map((f) => ({
      id: f.id,
      date: f.dueAt,
      type: "RELANCE" as const,
      title: f.status === "DONE" ? "Relance effectuée" : "Relance planifiée",
      note: f.note || "",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notes internes
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {prospect.internalNotes || "Aucune note interne."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Prochaine relance</p>
          <p className="mt-1 font-medium">
            {prospect.nextFollowUpAt
              ? new Date(prospect.nextFollowUpAt).toLocaleString("fr-FR")
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Dernier contact</p>
          <p className="mt-1 font-medium">
            {prospect.lastInteractionAt
              ? new Date(prospect.lastInteractionAt).toLocaleString("fr-FR")
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="mt-1 font-medium">{notes.length} note(s)</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historique
        </h2>
        <ul className="mt-4 space-y-4">
          {timelineItems.map((item) => {
            const Icon = icons[item.type] || CheckCircle;
            return (
              <li key={item.id} className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.date).toLocaleString("fr-FR")}
                  </p>
                  {item.note && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {item.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
