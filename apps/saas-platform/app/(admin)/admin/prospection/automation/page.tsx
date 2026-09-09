import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { stages, projectedMrr } from "@/lib/automation/core";
import { runWorker } from "./actions";
export const dynamic = "force-dynamic";
const euros = (c: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(c / 100);
export default async function AutomationPage() {
  await requireAdmin();
  const [projects, queue, failed, tickets] = await Promise.all([
    prisma.salesProject.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.automationMessage.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.automationMessage.findMany({
      where: { OR: [{ status: "FAILED" }, { lastError: { not: null } }] },
      select: { id: true, subject: true, lastError: true, status: true },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
  ]);
  const email =
    process.env.AUTOMATION_EMAILS_ENABLED === "true" &&
    !!process.env.BREVO_API_KEY;
  const payments =
    process.env.AUTOMATION_PAYMENTS_ENABLED === "true" &&
    !!process.env.STRIPE_SECRET_KEY &&
    !!process.env.STRIPE_WEBHOOK_SECRET;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Du prospect au site livré</h1>
          <p className="mt-2 text-sm text-slate-500">
            Demandes, paiements, briefs, validation et support.
          </p>
        </div>
        <form action={runWorker}>
          <button className="rounded-lg border bg-white px-4 py-2 text-sm text-slate-900">
            Traiter les tâches en attente
          </button>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Abonnements payés / mois", euros(projectedMrr(projects))],
          [
            "Demandes à qualifier",
            projects.filter((p) => p.stage === "NEW").length,
          ],
          ["Messages en attente", queue],
          ["Demandes de support", tickets],
        ].map(([label, value]) => (
          <div
            className="rounded-xl border bg-white p-5 text-slate-900"
            key={String(label)}
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-white p-5 text-sm text-slate-900">
        <p>
          Paiements : <strong>{payments ? "configurés" : "à activer"}</strong> ·
          E-mails :{" "}
          <strong>{email ? "activés" : "en attente de configuration"}</strong>
        </p>
        <p className="mt-2 text-slate-500">
          Le revenu affiché exclut les frais de création et les abonnements
          impayés. Il ne représente pas un bénéfice ni une rémunération nette.
        </p>
      </div>
      {!!failed.length && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-slate-900">
          <h2 className="font-semibold">Actions à vérifier</h2>
          <ul className="mt-3 space-y-2">
            {failed.map((m) => (
              <li key={m.id} className="text-sm">
                {m.subject} : {m.lastError} ({m.status})
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white text-slate-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Entreprise</th>
              <th className="p-4">Étape</th>
              <th className="p-4">Mensualité HT</th>
              <th className="p-4">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-4">
                  <Link
                    className="font-medium text-blue-700 underline"
                    href={`/admin/prospection/automation/${p.id}`}
                  >
                    {p.companyName}
                  </Link>
                  <p className="mt-1 text-slate-500">
                    {p.city} · {p.businessType}
                  </p>
                </td>
                <td className="p-4">{stages[p.stage]}</td>
                <td className="p-4">{euros(p.monthlyCents)}</td>
                <td className="p-4">{p.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!projects.length && (
          <p className="p-8 text-slate-500">
            Les nouvelles demandes du site apparaîtront ici.
          </p>
        )}
      </div>
    </div>
  );
}
