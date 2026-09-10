import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/prospection/auth";
import { STATUS_LABELS } from "@/lib/prospection/status";
export default async function Dashboard() {
  await requireAdmin();
  const [
    total,
    unqualified,
    mobile,
    email,
    stopped,
    due,
    replies,
    sentSms,
    sentEmail,
    won,
    activity,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { websiteFinding: "TO_CHECK" } }),
    prisma.prospect.count({
      where: {
        OR: [
          { phone: { startsWith: "+336" } },
          { phone: { startsWith: "+337" } },
        ],
      },
    }),
    prisma.prospect.count({ where: { email: { not: null } } }),
    prisma.prospect.count({ where: { doNotContactAt: { not: null } } }),
    prisma.followUp.count({
      where: { status: "PENDING", dueAt: { lte: new Date() } },
    }),
    prisma.prospect.count({ where: { status: "REPONDU" } }),
    prisma.smsOutreachMessage.count({ where: { status: "SENT" } }),
    prisma.outreachMessage.count({ where: { status: "SENT" } }),
    prisma.prospect.count({ where: { status: "CLIENT_SIGNE" } }),
    prisma.prospectInteraction.findMany({
      include: {
        prospect: { select: { id: true, companyName: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  const cards = [
    ["Entreprises", total, "/prospects"],
    ["À qualifier", unqualified, "/prospects?qualification=TO_CHECK"],
    ["Mobiles disponibles", mobile, "/prospects?channel=SMS"],
    ["Courriels disponibles", email, "/prospects?channel=EMAIL"],
    ["Réponses à traiter", replies, "/prospects?status=REPONDU"],
    ["Rappels échus", due, "/follow-ups"],
    ["SMS confirmés", sentSms, "/inbox"],
    ["E-mails acceptés", sentEmail, "/inbox"],
    ["Clients signés", won, "/clients"],
    ["Non-contact", stopped, "/prospects?stopped=yes"],
  ];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM de prospection</h1>
          <p className="mt-2 text-slate-600">
            Une fiche par entreprise, du repérage au client signé. SMS et
            e-mails réunis dans le même suivi.
          </p>
        </div>
        <Link
          href="/admin/prospection/import-export"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Importer des prospects
        </Link>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value, href]) => (
          <Link
            key={label}
            href={"/admin/prospection" + href}
            className="rounded-xl border bg-white p-4 hover:border-blue-500"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="mt-2 block text-2xl">
              {Number(value).toLocaleString("fr-FR")}
            </strong>
          </Link>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "1. Qualifier",
            "Vérifier l’activité, la source et la présence d’un site.",
            "/prospects?qualification=TO_CHECK",
          ],
          [
            "2. Préparer les messages",
            "Choisir le canal, personnaliser et valider les brouillons.",
            "/inbox?view=pending",
          ],
          [
            "3. Traiter les retours",
            "Répondre, planifier un rendez-vous et suivre les devis.",
            "/pipeline",
          ],
        ].map(([title, body, href]) => (
          <Link
            key={title}
            href={"/admin/prospection" + href}
            className="rounded-xl border bg-slate-50 p-5"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{body}</p>
          </Link>
        ))}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Dernières activités</h2>
        {!activity.length && (
          <p className="mt-3 text-sm text-slate-500">
            Aucun échange commercial enregistré. Les imports ne sont pas comptés
            comme des prises de contact.
          </p>
        )}
        {activity.map((e) => (
          <article key={e.id} className="mt-4 border-t pt-3">
            <Link
              href={`/admin/prospection/prospects/${e.prospectId}`}
              className="font-medium text-blue-700 underline"
            >
              {e.prospect.companyName}
            </Link>
            <p className="mt-1 text-xs text-slate-500">
              {e.createdAt.toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
              })}{" "}
              · {STATUS_LABELS[e.prospect.status]}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {e.note?.slice(0, 240)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
