import { readOptOutToken } from "@/lib/outreach/core";
import { stopLead } from "@/lib/outreach/service";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const html = (content: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Préférences de contact · FLEX-WEB</title><style>body{font:17px system-ui;background:#f5f7fa;color:#142030;margin:0;padding:24px}main{max-width:520px;margin:10vh auto;background:white;border-radius:16px;padding:32px}button{background:#142030;color:white;padding:14px 20px;border:0;border-radius:8px;font-size:16px;cursor:pointer}p{line-height:1.6}</style></head><body><main><p>FLEX-WEB</p>${content}</main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const id = readOptOutToken(token);
  if (
    !id ||
    !(await prisma.outreachLead.findUnique({
      where: { id },
      select: { id: true },
    }))
  )
    return html(
      "<h1>Lien non reconnu</h1><p>Pour ne plus être contacté, répondez STOP au message reçu ou écrivez à contact@flex-web.fr.</p>",
      404,
    );
  // GET is intentionally read-only: mail security scanners must not unsubscribe.
  return html(
    `<h1>Ne plus recevoir de prospection</h1><p>Confirmez votre choix pour arrêter les messages commerciaux de FLEX-WEB à cette adresse.</p><form method="post"><input type="hidden" name="token" value="${token}"><button>Confirmer la désinscription</button></form>`,
  );
}
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 1000)
    return html("<p>Demande invalide.</p>", 400);
  const raw = await request.text();
  if (raw.length > 1000) return html("<p>Demande invalide.</p>", 400);
  const id = readOptOutToken(new URLSearchParams(raw).get("token") || "");
  if (!id)
    return html(
      "<p>Lien invalide. Vous pouvez répondre STOP au message reçu.</p>",
      400,
    );
  await stopLead(id, "UNSUBSCRIBED");
  return html(
    "<h1>Votre choix est enregistré</h1><p>Les prochaines prises de contact commerciales sont arrêtées. Un message déjà en cours d’acheminement peut encore vous parvenir.</p>",
  );
}
