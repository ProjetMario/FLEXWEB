"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateProspectStatus, scheduleFollowUp } from "@/app/(admin)/admin/prospection/prospects/[id]/actions";
import { STATUS_LABELS } from "@/lib/prospection/status";
import { Copy, MessageSquare, CheckCircle, ThumbsUp, CalendarDays, FileText, UserCheck, XCircle, RotateCcw } from "lucide-react";
import type { ProspectionStatus } from "@prisma/client";

type ProspectLite = {
  id: string;
  phone: string;
  companyName: string;
  status: ProspectionStatus;
};

const statusActions: { status: ProspectionStatus; label: string; icon: typeof CheckCircle }[] = [
  { status: "SMS_ENVOYE", label: STATUS_LABELS["SMS_ENVOYE"], icon: MessageSquare },
  { status: "REPONDU", label: STATUS_LABELS["REPONDU"], icon: CheckCircle },
  { status: "INTERESSE", label: STATUS_LABELS["INTERESSE"], icon: ThumbsUp },
  { status: "RDV_PLANIFIE", label: STATUS_LABELS["RDV_PLANIFIE"], icon: CalendarDays },
  { status: "DEVIS_ENVOYE", label: STATUS_LABELS["DEVIS_ENVOYE"], icon: FileText },
  { status: "CLIENT_SIGNE", label: STATUS_LABELS["CLIENT_SIGNE"], icon: UserCheck },
  { status: "PERDU", label: STATUS_LABELS["PERDU"], icon: XCircle },
];

export function ProspectQuickActions({ prospect }: { prospect: ProspectLite }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);

  async function handleCopyPhone() {
    await navigator.clipboard.writeText(prospect.phone);
    setMessage("Numéro copié");
    setTimeout(() => setMessage(null), 2000);
  }

  async function handleCopySms() {
    const body = `Bonjour, je me permets de vous contacter car j'ai découvert votre entreprise ${prospect.companyName} sur Google. Je suis de la région et je crée des sites professionnels avec Flex-Web. Si cela peut vous intéresser, je serais ravi de vous montrer ce que je pourrais réaliser pour votre activité. Bonne journée !`;
    await navigator.clipboard.writeText(body);
    setMessage("SMS copié");
    setTimeout(() => setMessage(null), 2000);
  }

  async function handleStatus(status: ProspectionStatus) {
    setPending(true);
    const formData = new FormData();
    formData.set("prospectId", prospect.id);
    formData.set("status", status);
    await updateProspectStatus(formData);
    setPending(false);
  }

  async function handleScheduleFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!followUpDate) return;
    setPending(true);
    const formData = new FormData();
    formData.set("prospectId", prospect.id);
    formData.set("dueAt", new Date(followUpDate).toISOString());
    await scheduleFollowUp(formData);
    setPending(false);
    setShowFollowUp(false);
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:w-auto">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyPhone} disabled={pending}>
          <Copy className="mr-1.5 h-4 w-4" /> Copier le numéro
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopySms} disabled={pending}>
          <MessageSquare className="mr-1.5 h-4 w-4" /> Copier le SMS
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowFollowUp((v) => !v)} disabled={pending}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Relance
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {statusActions.map((a) => (
          <Button
            key={a.status}
            variant={prospect.status === a.status ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatus(a.status)}
            disabled={pending || prospect.status === a.status}
            className="justify-start"
          >
            <a.icon className="mr-1.5 h-4 w-4" />
            {a.label}
          </Button>
        ))}
      </div>

      {showFollowUp && (
        <form onSubmit={handleScheduleFollowUp} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <input
            type="datetime-local"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            required
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
          <Button type="submit" size="sm" disabled={pending}>
            Planifier
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowFollowUp(false)}>
            Annuler
          </Button>
        </form>
      )}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
