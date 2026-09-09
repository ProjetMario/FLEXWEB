import { prisma } from "@/lib/prisma";
import { keyMatches, limitedJson } from "@/lib/sms/core";
import { claimSms } from "@/lib/sms/service";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const cfg = await prisma.smsAutomationSettings.findUnique({
    where: { id: "onoff" },
  });
  if (!keyMatches(request.headers.get("x-api-key"), cfg?.dispatchKeyHash))
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  let value;
  try {
    value = z
      .object({
        mode: z.enum(["test", "claim"]),
        requestId: z.string().min(8).max(150).optional(),
      })
      .parse(await limitedJson(request));
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (value.mode === "test") {
    await prisma.smsAutomationSettings.update({
      where: { id: "onoff" },
      data: { dispatchVerifiedAt: new Date() },
    });
    return Response.json(
      {
        send: false,
        messageId: "test-no-send",
        from: cfg!.sender,
        to: "",
        text: "TEST DE CONNEXION — NE PAS ENVOYER",
        reason: "connection_verified",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!value.requestId)
    return Response.json(
      { error: "Identifiant d’exécution requis." },
      { status: 400 },
    );
  try {
    return Response.json(await claimSms(value.requestId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Traitement interrompu ; vérifier le journal avant tout nouvel essai.",
      },
      { status: 503 },
    );
  }
}
