import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { studioIdentity, checkOrigin, pilotAllowed } from "@/lib/studio/auth";
import {
  createSite,
  ownSite,
  saveSite,
  publishSite,
  visitorKey,
} from "@/lib/studio/service";
import { APP, paid, PUBLIC } from "@/lib/studio/core";
import { enqueueGeneration } from "@/lib/studio/jobs";
import { checkout, billing } from "@/lib/studio/payments";
import { setDomain, verifyDomain } from "@/lib/studio/domains";
import { upload } from "@/lib/studio/media";
import { HttpError } from "@/lib/automation/core";
import { rateLimit } from "@/lib/automation/service";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
async function bounded(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Données trop volumineuses.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    if ((await params).action !== "status")
      throw new HttpError(404, "Action inconnue.");
    const identity = await studioIdentity();
    const site = await prisma.studioSite.findUnique({
      where: { identityId: identity.id },
      include: {
        jobs: { orderBy: { createdAt: "desc" }, take: 30 },
        assets: {
          where: { state: "READY" },
          select: { id: true, bytes: true },
        },
        inquiries: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    const quotaPeriod =
      site && paid(site) && site.paidThrough
        ? `paid:${site.paidThrough.toISOString()}`
        : "trial";
    const used = site
      ? await prisma.studioJob.count({
          where: { siteId: site.id, quotaPeriod },
        })
      : 0;
    // Secrets, Stripe identifiers and provider payloads never belong in the browser response.
    return json({
      email: identity.email,
      allowed: pilotAllowed(identity.email),
      site: site
        ? {
            id: site.id,
            slug: site.slug,
            brief: site.brief,
            draft: site.draft,
            draftRevision: site.draftRevision,
            trialEndsAt: site.trialEndsAt,
            state: site.state,
            billingStatus: site.billingStatus,
            paidThrough: site.paidThrough,
            pastDueAt: site.pastDueAt,
            cancelAtPeriodEnd: site.cancelAtPeriodEnd,
            publishedAt: site.publishedAt,
            hasPrevious: !!site.previousPublished,
            domain: site.domain,
            domainToken: site.domainToken,
            domainState: site.domainState,
            domainError: site.domainError,
            assets: site.assets,
            inquiries: site.inquiries,
            jobs: site.jobs.map((j) => ({
              id: j.id,
              state: j.state,
              error: j.error,
              createdAt: j.createdAt,
            })),
            quotaUsed: used,
            quotaLimit: quotaPeriod === "trial" ? 3 : 20,
            publicUrl:
              site.domainState === "VERIFIED"
                ? `https://${site.domain}`
                : `${PUBLIC()}/sites/${site.slug}`,
          }
        : null,
      aiEnabled: process.env.STUDIO_AI_ENABLED === "true",
      paymentsEnabled: process.env.STUDIO_PAYMENTS_ENABLED === "true",
    });
  } catch (e) {
    return error(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    const identity = await studioIdentity();
    await rateLimit(`studio:${visitorKey(identity.id)}`, 120, 600);
    const action = (await params).action;
    if (action === "upload")
      return json(await upload(identity, await bounded(request, 4000000)));
    const input = JSON.parse(
      (await bounded(request, 65000)).toString() || "{}",
    );
    if (action === "create") {
      if (!pilotAllowed(identity.email))
        throw new HttpError(
          403,
          "Les essais sont actuellement réservés aux comptes pilotes.",
        );
      if (input.accepted !== true)
        throw new HttpError(400, "Acceptez les conditions de l’essai.");
      return json({ id: (await createSite(identity, input.brief)).id }, 201);
    }
    if (action === "save") {
      await saveSite(identity, input);
      return json({ ok: true });
    }
    if (action === "generate") {
      const job = await enqueueGeneration(identity, input);
      if (process.env.AUTOMATION_SHARED_SECRET) {
        try {
          await fetch(`${APP()}/.netlify/functions/studio-worker-background`, {
            method: "POST",
            headers: {
              "x-automation-secret": process.env.AUTOMATION_SHARED_SECRET,
            },
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          /* Scheduled worker resumes the persisted job. */
        }
      }
      return json({ jobId: job.id }, 202);
    }
    if (action === "checkout")
      return json({
        url: await checkout(
          identity,
          z.number().int().parse(input.revision),
          input.accepted === true,
        ),
      });
    if (action === "billing") return json({ url: await billing(identity) });
    const site = await ownSite(identity);
    if (action === "publish" || action === "restore") {
      if (input.confirmed !== true)
        throw new HttpError(400, "Validez les contenus avant publication.");
      await publishSite(
        site.id,
        z.number().int().parse(input.revision),
        action === "restore",
      );
      return json({ ok: true });
    }
    if (action === "domain") {
      await setDomain(identity, input.domain);
      return json({ ok: true });
    }
    if (action === "verify-domain") {
      await rateLimit(`domain:${site.id}`, 6, 3600);
      await verifyDomain(site.id);
      return json({ ok: true });
    }
    throw new HttpError(404, "Action inconnue.");
  } catch (e) {
    return error(e);
  }
}
function error(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError)
    return json({ error: e.issues[0]?.message || "Vérifiez les champs." }, 400);
  console.error("Studio request failed", e instanceof Error ? e.name : "error");
  return json(
    { error: "Action impossible pour le moment. Votre contenu est conservé." },
    500,
  );
}
