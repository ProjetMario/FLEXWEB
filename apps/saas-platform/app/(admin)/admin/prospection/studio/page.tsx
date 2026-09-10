import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function StudioAdmin() {
  await requireAdmin();
  const period = new Date().toISOString().slice(0, 7);
  const [total, live, trial, active, budget, sites, failures] =
    await Promise.all([
      prisma.studioSite.count(),
      prisma.studioSite.count({ where: { state: "LIVE" } }),
      prisma.studioSite.count({ where: { state: "TRIAL" } }),
      prisma.studioSite.count({
        where: { billingStatus: "ACTIVE", paidThrough: { gt: new Date() } },
      }),
      prisma.studioBudget.findUnique({ where: { period } }),
      prisma.studioSite.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { prospect: { select: { id: true, companyName: true } } },
      }),
      prisma.studioJob.findMany({
        where: { state: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { site: { select: { email: true } } },
      }),
    ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Sites autonomes</h1>
        <p className="mt-2 text-slate-500">
          Essais, abonnements, générations et incidents de l’offre Autonome.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Comptes", total],
          ["Essais actifs", trial],
          ["Sites publiés", live],
          ["Revenu récurrent HT", `${active * 49} €/mois`],
          [
            "Budget IA réservé",
            `${((budget?.reservedCents || 0) / 100).toFixed(2)} / 50 €`,
          ],
        ].map(([label, value]) => (
          <section className="rounded-xl border bg-white p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="text-xl">{value}</strong>
          </section>
        ))}
      </div>
      <section className="rounded-xl border bg-white p-5">
        <p>
          Essais publics :{" "}
          {process.env.STUDIO_OPEN_SIGNUP === "true"
            ? "ouverts"
            : "comptes pilotes uniquement"}{" "}
          · IA :{" "}
          {process.env.STUDIO_AI_ENABLED === "true" ? "active" : "désactivée"} ·
          Paiements :{" "}
          {process.env.STUDIO_PAYMENTS_ENABLED === "true"
            ? "actifs"
            : "désactivés"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Le budget réserve 0,25 € par appel, sans remboursement automatique des
          réservations ambiguës. Il s’agit d’un plafond conservateur, pas du
          coût réel facturé par le fournisseur.
        </p>
        <Link
          href="/studio"
          className="mt-3 inline-block text-blue-700 underline"
        >
          Ouvrir l’espace client
        </Link>
      </section>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Entreprise", "Compte", "État", "Facturation", "CRM"].map(
                (x) => (
                  <th key={x} className="p-4">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-4">{s.prospect?.companyName || s.slug}</td>
                <td className="p-4">{s.email}</td>
                <td className="p-4">{s.state}</td>
                <td className="p-4">{s.billingStatus}</td>
                <td className="p-4">
                  {s.prospectId && (
                    <Link
                      className="text-blue-700"
                      href={`/admin/prospection/prospects/${s.prospectId}`}
                    >
                      Ouvrir
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Dernières générations interrompues</h2>
        {!failures.length && (
          <p className="mt-3 text-slate-500">Aucun incident enregistré.</p>
        )}
        {failures.map((f) => (
          <p key={f.id} className="mt-3 border-t pt-3 text-sm">
            {f.site.email} · {f.error}
          </p>
        ))}
      </section>
    </div>
  );
}
