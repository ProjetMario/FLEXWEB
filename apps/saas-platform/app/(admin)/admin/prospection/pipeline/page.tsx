import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import type { ProspectionStatus } from "@prisma/client";
const columns: { name: string; statuses: ProspectionStatus[] }[] = [
  { name: "À qualifier", statuses: ["NOUVEAU"] },
  { name: "À contacter", statuses: ["A_CONTACTER"] },
  {
    name: "Contactés / à relancer",
    statuses: [
      "SMS_ENVOYE",
      "SANS_REPONSE",
      "A_RELANCER",
      "A_RECONTACTER_PLUS_TARD",
    ],
  },
  {
    name: "En discussion",
    statuses: ["REPONDU", "INTERESSE", "RDV_PLANIFIE", "RDV_EFFECTUE"],
  },
  { name: "Devis et négociation", statuses: ["DEVIS_ENVOYE", "NEGOCIATION"] },
  { name: "Clients signés", statuses: ["CLIENT_SIGNE"] },
  { name: "Classés / refus", statuses: ["PAS_INTERESSE", "PERDU"] },
];
export default async function Pipeline() {
  await requireAdmin();
  const data = await Promise.all(
    columns.map(async (c) => ({
      ...c,
      count: await prisma.prospect.count({
        where: { status: { in: c.statuses } },
      }),
      items: await prisma.prospect.findMany({
        where: { status: { in: c.statuses } },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    })),
  );
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Suivi commercial</h1>
        <p className="mt-2 text-slate-600">
          Ouvrez une fiche pour modifier son étape, préparer un message ou
          programmer une action.
        </p>
      </header>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {data.map((c) => (
          <section
            key={c.name}
            className="w-72 shrink-0 rounded-xl bg-slate-100 p-3"
          >
            <h2 className="mb-3 font-semibold">
              {c.name}{" "}
              <span className="float-right text-slate-500">
                {c.count.toLocaleString("fr-FR")}
              </span>
            </h2>
            <div className="space-y-3">
              {c.items.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/prospection/prospects/${p.id}`}
                  className="block rounded-lg border bg-white p-3 hover:border-blue-500"
                >
                  <strong className="block text-sm">{p.companyName}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.city} · {p.businessType || "Activité à préciser"}
                  </p>
                  <p className="mt-2 text-xs">
                    {p.doNotContactAt
                      ? "Ne plus contacter"
                      : p.preferredChannel === "NONE"
                        ? "Canal à choisir"
                        : p.preferredChannel === "EMAIL"
                          ? "E-mail"
                          : "SMS"}
                  </p>
                  {p.nextFollowUpAt && (
                    <p className="mt-1 text-xs">
                      Rappel : {p.nextFollowUpAt.toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {p.estimatedValue != null && (
                    <p className="mt-2 text-sm">
                      {p.estimatedValue.toLocaleString("fr-FR")} €
                    </p>
                  )}
                </Link>
              ))}
              {!c.items.length && (
                <p className="p-3 text-sm text-slate-500">Aucune fiche.</p>
              )}
              {c.count > 12 && (
                <Link
                  className="block text-sm text-blue-700 underline"
                  href={`/admin/prospection/prospects?statuses=${c.statuses.join(",")}`}
                >
                  Voir les {c.count} fiches
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
