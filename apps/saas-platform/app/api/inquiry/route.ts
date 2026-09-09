import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getTenantFromRequest } from "@/lib/tenant";
import { rateLimit } from "@/lib/automation/service";
import { HttpError } from "@/lib/automation/core";
export async function POST(request: Request) {
  try {
    const host = request.headers.get("host");
    const origin = request.headers.get("origin");
    if (!host || !origin || new URL(origin).host !== host)
      return Response.json({ error: "Origine non autorisée" }, { status: 403 });
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 12000)
      return Response.json({ error: "Demande trop longue" }, { status: 413 });
    const data = z
      .object({
        requestKey: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        email: z.email().max(254),
        phone: z.string().min(8).max(25),
        city: z.string().min(1).max(120),
        service: z.string().min(1).max(160),
        message: z.string().min(15).max(3000),
        privacy: z.literal("yes"),
        websiteTrap: z.literal(""),
      })
      .parse(JSON.parse(raw));
    const tenant = await getTenantFromRequest();
    if (!tenant)
      return Response.json({ error: "Site introuvable" }, { status: 404 });
    const website = await prisma.website.findFirst({
      where: {
        organizationId: tenant.organizationId,
        isPublished: true,
        organization: { status: "ACTIVE" },
      },
    });
    if (!website)
      return Response.json({ error: "Site non publié" }, { status: 404 });
    await rateLimit(`inquiry:${tenant.organizationId}`, 100);
    const form = await prisma.form.findFirst({
      where: {
        organizationId: tenant.organizationId,
        name: "Demande de devis",
        isActive: true,
      },
    });
    if (!form)
      return Response.json(
        { error: "Formulaire indisponible" },
        { status: 503 },
      );
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${tenant.organizationId} FOR UPDATE`;
      const key = `inquiry:${tenant.organizationId}:${data.requestKey}`;
      // A unique event key makes retries safe without duplicating the lead or notification.
      if (await tx.automationEvent.findUnique({ where: { externalId: key } }))
        return;
      await tx.automationEvent.create({
        data: {
          externalId: key,
          type: "INQUIRY",
          detail: "Demande de devis reçue.",
        },
      });
      const stored = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        city: data.city,
        service: data.service,
        message: data.message,
      };
      await tx.formSubmission.create({
        data: {
          organizationId: tenant.organizationId,
          formId: form.id,
          data: stored,
        },
      });
      await tx.lead.create({
        data: {
          organizationId: tenant.organizationId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          message: `${data.service} · ${data.city}\n${data.message}`,
          source: "site-client",
        },
      });
      for (const to of form.notifyEmails)
        await tx.automationMessage.create({
          data: {
            dedupeKey: `${key}:${to}`,
            to,
            subject: "Nouvelle demande de devis sur votre site",
            text: `${data.name}\n${data.email} · ${data.phone}\n${data.city} · ${data.service}\n\n${data.message}`,
          },
        });
    });
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json(
        { error: "Vérifiez les champs du formulaire." },
        { status: 400 },
      );
    return Response.json(
      { error: "Le message n’a pas pu être confirmé. Réessayez." },
      { status: 503 },
    );
  }
}
