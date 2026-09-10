import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function Statistics() {
  await requireAdmin();
  const [total, toCheck, qualified, stopped, sms, email, replies, won, amount] =
    await Promise.all([
      prisma.prospect.count(),
      prisma.prospect.count({ where: { websiteFinding: "TO_CHECK" } }),
      prisma.prospect.count({ where: { websiteFinding: "NOT_FOUND" } }),
      prisma.prospect.count({ where: { doNotContactAt: { not: null } } }),
      prisma.smsOutreachMessage.groupBy({ by: ["status"], _count: true }),
      prisma.outreachMessage.groupBy({ by: ["status"], _count: true }),
      prisma.prospectInteraction.groupBy({
        by: ["prospectId"],
        where: { type: "REPONSE_RECUE" },
      }),
      prisma.prospect.count({ where: { status: "CLIENT_SIGNE" } }),
      prisma.prospect.aggregate({
        where: { status: "CLIENT_SIGNE" },
        _sum: { signedValue: true, monthlyPrice: true },
      }),
    ]);
  const labels: Record<string, string> = {
    DRAFT: "Brouillons",
    APPROVED: "Validés",
    SENT: "Envois confirmés / acceptés",
    REVIEW: "À vérifier",
    DISPATCHED: "Transmis à Zapier",
    SENDING: "En cours",
    SKIPPED: "Arrêtés",
  };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Résultats de la prospection</h1>
      <p className="text-slate-600">
        Toutes périodes. Les compteurs d’envoi reposent sur les confirmations du
        transport, pas sur le statut commercial.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Fiches CRM", total],
          ["À qualifier", toCheck],
          ["Sans site trouvé après contrôle", qualified],
          ["Non-contact", stopped],
          ["Entreprises ayant répondu ou refusé", replies.length],
          ["Clients signés", won],
          ["Devis signés (€)", amount._sum.signedValue || 0],
          ["Abonnements signés (€/mois)", amount._sum.monthlyPrice || 0],
        ].map(([label, n]) => (
          <div className="rounded-xl border bg-white p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="text-2xl">
              {Number(n).toLocaleString("fr-FR")}
            </strong>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["SMS", sms],
          ["E-mails", email],
        ].map(([title, rows]) => (
          <section
            className="rounded-xl border bg-white p-5"
            key={String(title)}
          >
            <h2 className="font-semibold">{String(title)}</h2>
            {(rows as typeof sms).map((r) => (
              <p className="mt-3 flex justify-between text-sm" key={r.status}>
                <span>{labels[r.status] || r.status}</span>
                <strong>{r._count}</strong>
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Un e-mail accepté par IONOS ou un SMS confirmé par Onoff ne garantit pas
        sa lecture. Les montants sont issus des fiches commerciales, sans
        déduction des charges.
      </p>
      <Link href="/admin/prospection/inbox" className="text-blue-700 underline">
        Ouvrir les messages
      </Link>
    </div>
  );
}
