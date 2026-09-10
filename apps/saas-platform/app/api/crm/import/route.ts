import { crmOriginAllowed } from "@/lib/prospection/crm-origin";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { importProspects } from "@/lib/prospection/crm-service";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Connexion nécessaire." }, { status: 401 });
  if (
    !(await prisma.membership.findFirst({
      where: { userId: session.user.id, role: "SUPER_ADMIN" },
    }))
  )
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  if (!crmOriginAllowed(request))
    return Response.json({ error: "Origine refusée." }, { status: 403 });
  const reader = request.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (!reader)
    return Response.json({ error: "Données manquantes." }, { status: 400 });
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 500000) {
      await reader.cancel();
      return Response.json({ error: "Lot trop volumineux." }, { status: 413 });
    }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!Array.isArray(body.rows) || typeof body.batch !== "string")
      throw Error("Lot invalide.");
    return Response.json(await importProspects(body.rows, body.batch));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && !error.message.includes("prisma")
            ? error.message.slice(0, 220)
            : "Import impossible. Aucun envoi n’a été déclenché.",
      },
      { status: 400 },
    );
  }
}
