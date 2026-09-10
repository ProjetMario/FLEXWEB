import type Stripe from "stripe";
import { prisma } from "../prisma";
import { stripeClient } from "../automation/payments";
import { HttpError } from "../automation/core";
import { crmLock, stopCrmSequences } from "../prospection/crm-service";
import { APP, PRICE, TERMS, snapshot, publicationErrors } from "./core";
import { lockSite, ownSite, publishSite, notifySite } from "./service";
import type { Identity } from "./auth";
export async function checkout(
  identity: Identity,
  revision: number,
  accepted: boolean,
  provider?: Stripe,
) {
  if (process.env.STUDIO_PAYMENTS_ENABLED !== "true")
    throw new HttpError(
      503,
      "Les abonnements sont en cours de vérification. Votre aperçu reste disponible.",
    );
  if (!accepted)
    throw new HttpError(
      400,
      "Validez les contenus et acceptez les conditions avant le paiement.",
    );
  const s = await ownSite(identity),
    stripe = provider || stripeClient();
  return prisma.$transaction(
    async (tx) => {
      await lockSite(tx, s.id);
      const current = await tx.studioSite.findUniqueOrThrow({
        where: { id: s.id },
      });
      if (current.draftRevision !== revision)
        throw new HttpError(409, "Actualisez le contenu avant de payer.");
      const snap = snapshot(current),
        errors = publicationErrors(snap.brief, snap.content);
      if (errors.length) throw new HttpError(400, errors.join(" "));
      if (current.stripeSubscriptionId && current.billingStatus !== "CANCELED")
        throw new HttpError(
          409,
          "Un abonnement existe déjà. Ouvrez votre facturation.",
        );
      if (current.stripeSessionId) {
        const old = await stripe.checkout.sessions.retrieve(
          current.stripeSessionId,
        );
        if (old.status === "open") {
          await tx.studioSite.update({
            where: { id: s.id },
            data: { approvedRevision: revision },
          });
          return old.url;
        }
        if (old.status === "complete" && current.billingStatus !== "CANCELED")
          throw new HttpError(409, "Confirmation du paiement en cours.");
      }
      const key = `studio-checkout:${s.id}:${current.stripeSessionId || "first"}`;
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          client_reference_id: s.id,
          ...(current.stripeCustomerId
            ? { customer: current.stripeCustomerId }
            : { customer_email: identity.email }),
          line_items: [
            {
              price_data: {
                currency: "eur",
                unit_amount: PRICE,
                recurring: { interval: "month" },
                tax_behavior: "exclusive",
                product_data: {
                  name: "FLEX-WEB Autonome — site vitrine",
                  description:
                    "49 € HT/mois, sans frais de création. Un site, hébergement, édition et 20 retouches IA par mois.",
                },
              },
              quantity: 1,
            },
          ],
          automatic_tax: { enabled: true },
          billing_address_collection: "required",
          tax_id_collection: { enabled: true },
          metadata: { studioSiteId: s.id, termsVersion: TERMS },
          subscription_data: { metadata: { studioSiteId: s.id } },
          success_url: `${APP()}/studio?payment=success`,
          cancel_url: `${APP()}/studio?payment=cancel`,
        },
        { idempotencyKey: key },
      );
      await tx.studioSite.update({
        where: { id: s.id },
        data: { stripeSessionId: session.id, approvedRevision: revision },
      });
      await tx.studioEvent.create({
        data: {
          siteId: s.id,
          key: `terms:${session.id}`,
          kind: "TERMS_ACCEPTED",
          detail: `Conditions ${TERMS}, 49 € HT/mois, version ${revision} validée.`,
        },
      });
      return session.url;
    },
    { timeout: 20000 },
  );
}
export async function billing(identity: Identity) {
  const s = await ownSite(identity);
  if (!s.stripeCustomerId)
    throw new HttpError(409, "Aucune facturation disponible.");
  if (!process.env.STRIPE_BILLING_PORTAL_CONFIGURATION)
    throw new HttpError(503, "Le portail de facturation doit être configuré.");
  return (
    await stripeClient().billingPortal.sessions.create({
      customer: s.stripeCustomerId,
      configuration: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION,
      return_url: `${APP()}/studio`,
    })
  ).url;
}
export async function refreshSubscription(
  id: string,
  stripe: Stripe = stripeClient(),
) {
  // Read authoritative Stripe state inside a per-site lock; delivery order cannot resurrect an older state.
  const updated = await prisma.$transaction(
    async (tx) => {
      await lockSite(tx, id);
      const s = await tx.studioSite.findUniqueOrThrow({ where: { id } });
      if (!s.stripeSubscriptionId) return s;
      const sub = await stripe.subscriptions.retrieve(s.stripeSubscriptionId);
      if (sub.metadata.studioSiteId !== s.id)
        throw Error("Subscription ownership mismatch");
      const state =
        sub.status === "active"
          ? "ACTIVE"
          : ["canceled", "unpaid", "incomplete_expired"].includes(sub.status)
            ? "CANCELED"
            : "PAST_DUE";
      const through = Math.max(
        ...sub.items.data.map((i) => i.current_period_end || 0),
      );
      const restore = state === "ACTIVE" && through * 1000 > Date.now() &&
        !!s.published && s.state === "SUSPENDED";
      if (restore) {
        await tx.website.update({
          where: { id: s.websiteId },
          data: { isPublished: true },
        });
      }
      await crmLock(tx);
      if (s.prospectId && state === "ACTIVE") {
        const p = await tx.prospect.findUniqueOrThrow({
          where: { id: s.prospectId },
        });
        await stopCrmSequences(tx, p.id, "ABONNE_AUTONOME");
        await tx.prospect.update({
          where: { id: p.id },
          data: { status: "CLIENT_SIGNE", monthlyPrice: 49, setupFee: 0 },
        });
      }
      return tx.studioSite.update({
        where: { id },
        data: {
          billingStatus: state,
          paidThrough: through ? new Date(through * 1000) : null,
          pastDueAt: state === "PAST_DUE" ? s.pastDueAt || new Date() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          lastBillingCheck: new Date(),
          ...(restore ? { state: "LIVE" } : {}),
        },
      });
    },
    { timeout: 20000 },
  );
  if (updated.billingStatus === "ACTIVE") {
    if (
      !updated.published &&
      updated.approvedRevision === updated.draftRevision
    )
      await publishSite(id, updated.draftRevision);
    await notifySite(
      updated,
      `paid:${updated.paidThrough?.toISOString()}`,
      "Votre abonnement FLEX-WEB",
      updated.published
        ? "Votre abonnement est actif."
        : "Votre abonnement est actif. Retrouvez votre site et son état de publication dans votre espace.",
    );
  } else
    await notifySite(
      updated,
      `billing:${updated.billingStatus}:${updated.pastDueAt?.toISOString() || updated.paidThrough?.toISOString()}`,
      "Votre abonnement FLEX-WEB nécessite votre attention",
      updated.billingStatus === "PAST_DUE"
        ? "Un paiement est en attente. Vous disposez de sept jours pour le régulariser avant suspension."
        : "Votre abonnement a pris fin. Votre contenu reste conservé dans votre espace.",
    );
  return updated;
}
export async function applyStudioStripeEvent(
  stripe: Stripe,
  event: Stripe.Event,
) {
  const object = event.data.object;
  let id: string | undefined, subscriptionId: string | undefined;
  if (object.object === "checkout.session") {
    id = object.metadata?.studioSiteId;
    if (!id) return false;
    if (
      ![
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type) ||
      object.payment_status !== "paid"
    )
      return true;
    subscriptionId =
      typeof object.subscription === "string"
        ? object.subscription
        : object.subscription?.id;
    if (!subscriptionId) throw Error("Missing subscription");
    const currentSession = await prisma.$transaction(async (tx) => {
      await lockSite(tx, id!);
      const s = await tx.studioSite.findUniqueOrThrow({ where: { id } });
      // A signed event for a previous checkout must not replace the current subscription.
      if (s.stripeSessionId !== object.id) return false;
      await tx.studioSite.update({
        where: { id },
        data: {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId:
            typeof object.customer === "string"
              ? object.customer
              : object.customer?.id,
        },
      });
      return true;
    });
    if (!currentSession) return true;
  } else if (object.object === "subscription") {
    id = object.metadata.studioSiteId;
  } else if (object.object === "invoice") {
    const ref = object.parent?.subscription_details?.subscription;
    subscriptionId = typeof ref === "string" ? ref : ref?.id;
    if (subscriptionId)
      id = (
        await prisma.studioSite.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        })
      )?.id;
  }
  if (!id) return false;
  await refreshSubscription(id, stripe);
  await prisma.studioEvent.upsert({
    where: { key: `stripe:${event.id}` },
    create: {
      siteId: id,
      key: `stripe:${event.id}`,
      kind: "BILLING",
      detail: event.type,
    },
    update: {},
  });
  return true;
}
