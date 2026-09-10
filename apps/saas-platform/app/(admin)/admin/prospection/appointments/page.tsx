import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function Appointments() {
  await requireAdmin();
  const rows = await prisma.appointment.findMany({
    where: { prospectId: { not: null } },
    include: { prospect: true },
    orderBy: { date: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Rendez-vous de prospection</h1>
      <p className="text-slate-600">
        Les 100 derniers rendez-vous reliés au CRM. Les rendez-vous peuvent être
        planifiés depuis la qualification d’une séquence e-mail.
      </p>
      {!rows.length && (
        <p className="rounded-xl border bg-white p-5">
          Aucun rendez-vous enregistré.
        </p>
      )}
      {rows.map((a) => (
        <article key={a.id} className="rounded-xl border bg-white p-4">
          <Link
            href={`/admin/prospection/prospects/${a.prospectId}`}
            className="font-semibold text-blue-700 underline"
          >
            {a.prospect?.companyName || a.name}
          </Link>
          <p className="mt-2">
            {a.date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
          </p>
          <p className="mt-2 text-sm">{a.notes}</p>
        </article>
      ))}
    </div>
  );
}
