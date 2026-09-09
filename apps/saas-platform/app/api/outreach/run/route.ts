import { secretMatches } from "@/lib/automation/core";
import { runOutreach } from "@/lib/outreach/jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (
    !secretMatches(
      request.headers.get("x-automation-secret"),
      process.env.AUTOMATION_SHARED_SECRET,
    )
  )
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  try {
    return Response.json(await runOutreach(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Traitement interrompu. Aucun renvoi automatique des messages incertains.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
