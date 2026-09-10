import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { APP, PUBLIC, visible } from "@/lib/studio/core";
import { rateLimit, queueMessage } from "@/lib/automation/service";
import { visitorKey } from "@/lib/studio/service";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 12000)
      return Response.json({ error: "Message trop long." }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 12000)
      return Response.json({ error: "Message trop long." }, { status: 413 });
    const data = z
      .object({
        siteId: z.uuid(),
        name: z.string().trim().min(2).max(100),
        email: z.email().max(200),
        message: z.string().trim().min(10).max(4000),
        companyWebsite: z.string().max(200).default(""),
        accepted: z.literal(true),
      })
      .parse(JSON.parse(raw));
    if (data.companyWebsite) return Response.json({ ok: true });
    const s = await prisma.studioSite.findUnique({
      where: { id: data.siteId },
    });
    if (!s || !visible(s))
      return Response.json({ error: "Site indisponible." }, { status: 404 });
    const allowed = [
      APP(),
      PUBLIC(),
      ...(s.domainState === "VERIFIED" ? [`https://${s.domain}`] : []),
    ];
    const origin = request.headers.get("origin") || "";
    if (!allowed.includes(origin))
      return Response.json({ error: "Origine refusée." }, { status: 403 });
    await rateLimit(
      `studio-inquiry:${visitorKey((request.headers.get("x-nf-client-connection-ip") || "unknown") + s.id)}`,
      8,
      3600,
    );
    const inquiry = await prisma.studioInquiry.create({
      data: {
        siteId: s.id,
        name: data.name,
        email: data.email,
        message: data.message,
      },
    });
    await queueMessage({
      dedupeKey: `studio-inquiry:${inquiry.id}`,
      to: s.email,
      subject: "Une demande reçue sur votre site",
      text: `${data.name} vous a écrit. Consultez la demande dans votre espace ${APP()}/studio.\nFLEX-WEB`,
    });
    const headers = {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Cache-Control": "no-store",
    };
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Vérifiez les champs ou réessayez plus tard." },
      { status: 400 },
    );
  }
}
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  let allowed = [APP(), PUBLIC()].includes(origin);
  if (!allowed) {
    try {
      const host = new URL(origin).hostname;
      allowed =
        origin === `https://${host}` &&
        !!(await prisma.studioSite.findFirst({
          where: { domain: host, domainState: "VERIFIED" },
        }));
    } catch {}
  }
  return new Response(null, {
    status: allowed ? 204 : 403,
    headers: allowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        }
      : {},
  });
}
