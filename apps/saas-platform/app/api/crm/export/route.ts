import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { csvCell } from "@/lib/prospection/crm-csv";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Connexion nécessaire." }, { status: 401 });
  if (
    !(await prisma.membership.findFirst({
      where: { userId: session.user.id, role: "SUPER_ADMIN" },
    }))
  )
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  const rows = await prisma.prospect.findMany({
    orderBy: { id: "asc" },
    take: 10000,
  });
  const headers = [
    "entreprise",
    "activite",
    "departement",
    "commune",
    "telephone",
    "email",
    "siren",
    "siret",
    "source",
    "url_source",
    "date_collecte",
    "etat_registre",
    "notes",
    "qualification",
    "statut",
    "canal",
    "non_contact",
    "prochaine_relance",
  ];
  const lines = [
    headers,
    ...rows.map((p) => [
      p.companyName,
      p.businessType,
      p.department,
      p.city,
      p.phone.startsWith("+33") ? "0" + p.phone.slice(3) : p.phone,
      p.email,
      p.siren,
      p.siret,
      p.source,
      p.sourceUrl,
      p.sourceCheckedAt?.toISOString().slice(0, 10),
      p.registryState,
      p.internalNotes,
      p.websiteFinding,
      p.status,
      p.preferredChannel,
      p.doNotContactAt?.toISOString(),
      p.nextFollowUpAt?.toISOString(),
    ]),
  ];
  return new Response(
    "\uFEFF" + lines.map((r) => r.map(csvCell).join(";")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="flexweb-crm.csv"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
