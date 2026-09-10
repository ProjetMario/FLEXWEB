import Link from "next/link";
import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import { crmAction } from "../crm-actions";
export default async function FollowUpsPage() {
  await requireAdmin();
  const tasks = await prisma.followUp.findMany({
    where: { status: "PENDING" },
    include: { prospect: true },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Relances et rappels</h1>
        <p className="mt-2 text-slate-600">
          Actions manuelles à effectuer, classées par échéance. Les relances
          e-mail automatiques sont visibles dans les séquences.
        </p>
      </header>
      {!tasks.length && (
        <p className="rounded-xl border bg-white p-6">
          Aucun rappel en attente. Planifiez une action depuis une fiche
          prospect.
        </p>
      )}
      {tasks.map((t) => (
        <article
          key={t.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4"
        >
          <div>
            <Link
              className="font-semibold text-blue-700 underline"
              href={`/admin/prospection/prospects/${t.prospectId}`}
            >
              {t.prospect.companyName}
            </Link>
            <p
              className={`mt-1 text-sm ${t.dueAt < new Date() ? "text-amber-700" : "text-slate-500"}`}
            >
              {t.dueAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}{" "}
              {t.dueAt < new Date() ? "· À traiter" : ""}
            </p>
            <p className="mt-2 text-sm">{t.note}</p>
          </div>
          <form action={crmAction}>
            <input type="hidden" name="id" value={t.prospectId} />
            <input type="hidden" name="followUpId" value={t.id} />
            <button
              name="action"
              value="done"
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Marquer comme effectué
            </button>
          </form>
        </article>
      ))}
      {tasks.length === 100 && (
        <p className="text-sm text-slate-500">
          Les 100 prochaines actions sont affichées.
        </p>
      )}
    </div>
  );
}
