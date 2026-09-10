import { crmOriginAllowed } from "@/lib/prospection/crm-origin";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { linkLegacyCrm } from "@/lib/prospection/crm-service";
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
  return Response.json(await linkLegacyCrm());
}
