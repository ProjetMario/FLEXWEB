import { prisma } from "@/lib/prisma";
import { keyMatches, limitedJson, SmsInputError } from "@/lib/sms/core";
import { recordOnoff } from "@/lib/sms/service";
import { ZodError } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const cfg = await prisma.smsAutomationSettings.findUnique({
    where: { id: "onoff" },
  });
  if (!keyMatches(request.headers.get("x-api-key"), cfg?.webhookKeyHash))
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  try {
    await recordOnoff(await limitedJson(request));
    return Response.json({}, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json(
      { error: "Événement non traité." },
      {
        status:
          e instanceof SmsInputError ||
          e instanceof SyntaxError ||
          e instanceof ZodError
            ? 400
            : 503,
      },
    );
  }
}
