import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, secretMatches } from "@/lib/automation/core";
import {
  createIntake,
  getProject,
  publicProject,
  rateLimit,
  submitBrief,
  event,
} from "@/lib/automation/service";
import { startCheckout, stripeClient } from "@/lib/automation/payments";
import { initializeOwner } from "@/lib/automation/owner";
import { runAutomation } from "@/lib/automation/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    if (
      !secretMatches(
        request.headers.get("x-automation-secret"),
        process.env.AUTOMATION_SHARED_SECRET,
      )
    )
      throw new HttpError(401, "Accès refusé.");
    const { action } = await context.params;
    if (action === "run") return json(await runAutomation());
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new HttpError(415, "Format non accepté.");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 24000)
      throw new HttpError(413, "Votre demande est trop volumineuse.");
    const input = JSON.parse(raw);
    if (action === "initialize-owner") return json(await initializeOwner(input));
    const ip = request.headers.get("x-visitor-key");
    if (!ip || !/^[a-f0-9]{64}$/.test(ip))
      throw new HttpError(400, "Origine de la demande manquante.");
    await rateLimit(`request:${ip}`, 100, 600);
    if (action === "intake") {
      await rateLimit(`intake:${ip}`, 8);
      const project = await createIntake(input);
      return json({ projectId: project.id }, 201);
    }
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") || null;
    const project = await getProject(token);
    if (action === "status") return json(await publicProject(project));
    if (action === "checkout")
      return json({
        url: await startCheckout(project, input.accepted === true),
      });
    if (action === "billing") {
      if (
        process.env.AUTOMATION_PAYMENTS_ENABLED !== "true" ||
        !process.env.STRIPE_BILLING_PORTAL_CONFIGURATION
      )
        throw new HttpError(503, "Contactez FLEX-WEB pour votre facturation.");
      if (!project.stripeCustomerId || !project.paidAt)
        throw new HttpError(409, "Aucun abonnement à gérer.");
      const session = await stripeClient().billingPortal.sessions.create({
        customer: project.stripeCustomerId,
        configuration: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION,
        return_url: `${process.env.MARKETING_URL || "https://flex-web.fr"}/espace-projet/`,
      });
      return json({ url: session.url });
    }
    if (action === "brief") {
      await submitBrief(project, input);
      return json({ ok: true });
    }
    if (action === "approve") {
      if (input.confirmed !== true)
        throw new HttpError(400, "Confirmez la validation du contenu.");
      const updated = await prisma.salesProject.updateMany({
        where: {
          id: project.id,
          stage: "CLIENT_REVIEW",
          paymentStatus: "PAID",
        },
        data: { stage: "APPROVED", clientApprovedAt: new Date() },
      });
      if (!updated.count)
        throw new HttpError(409, "Le projet n’attend pas de validation.");
      await event(
        project.id,
        "CLIENT_APPROVED",
        `Le client a validé la version ${project.draftVersion}.`,
      );
      return json({ ok: true });
    }
    if (action === "support") {
      if (!project.paidAt)
        throw new HttpError(
          409,
          "Contactez contact@flex-web.fr pour toute question avant commande.",
        );
      await rateLimit(`support:${project.id}`, 10, 86400);
      const data = z
        .object({
          requestKey: z.string().uuid(),
          subject: z.string().trim().min(3).max(160),
          message: z.string().trim().min(10).max(4000),
        })
        .parse(input);
      const ticket = await prisma.supportTicket.upsert({
        where: { requestKey: data.requestKey },
        update: {},
        create: { ...data, projectId: project.id },
      });
      if (
        ticket.projectId !== project.id ||
        ticket.subject !== data.subject ||
        ticket.message !== data.message
      )
        throw new HttpError(409, "Demande déjà utilisée.");
      if (project.stage === "CLIENT_REVIEW")
        await prisma.salesProject.updateMany({
          where: { id: project.id, stage: "CLIENT_REVIEW" },
          data: {
            stage: "REVISION_REQUESTED",
            clientApprovedAt: null,
            qaApprovedAt: null,
          },
        });
      return json({ ticketId: ticket.id });
    }
    throw new HttpError(404, "Action inconnue.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: "Vérifiez les champs de votre demande.",
          fields: error.flatten().fieldErrors,
        },
        400,
      );
    if (error instanceof SyntaxError)
      return json({ error: "Demande invalide." }, 400);
    console.error(
      "Automation request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error:
          "Le service est momentanément indisponible. Vos saisies sont conservées à l’écran. Contactez contact@flex-web.fr si le problème persiste.",
      },
      503,
    );
  }
}
