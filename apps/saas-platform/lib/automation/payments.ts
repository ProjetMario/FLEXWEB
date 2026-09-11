import Stripe from "stripe";
import { isPublicQuote, isInclusiveQuote, quoteTaxLabel, TTC_QUOTE_VERSION, type QuoteSnapshot } from "./public-quote-pricing";
import { prisma } from "../prisma";
import { HttpError, offerFor, TERMS_VERSION, assertStandardQuote } from "./core";
import { marketingUrl } from "./service";
import type { SalesProject } from "@prisma/client";

export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new HttpError(
      503,
      "Le paiement en ligne sera disponible après confirmation par FLEX-WEB.",
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 10000,
    maxNetworkRetries: 1,
  });
}
export async function startCheckout(
  project: SalesProject,
  accepted: boolean,
  provider?: Stripe,
) {
  assertStandardQuote(project.offerSnapshot);
  if (!accepted)
    throw new HttpError(
      400,
      "Acceptez la proposition et les conditions avant de poursuivre.",
    );
  if (process.env.AUTOMATION_PAYMENTS_ENABLED !== "true")
    throw new HttpError(
      503,
      "Le paiement sera organisé avec votre interlocuteur FLEX-WEB.",
    );
  if (!provider && !process.env.STRIPE_WEBHOOK_SECRET)
    throw new HttpError(
      503,
      "La confirmation sécurisée des paiements doit être configurée.",
    );
  const stripe = provider || stripeClient();
  // The row lock prevents concurrent clicks from creating several billable subscriptions.
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SalesProject" WHERE id = ${project.id} FOR UPDATE`;
      const current = await tx.salesProject.findUniqueOrThrow({
        where: { id: project.id },
      });
      assertStandardQuote(current.offerSnapshot);
      if (
        current.stage !== "AWAITING_PAYMENT" ||
        current.paymentStatus !== "UNPAID"
      )
        throw new HttpError(409, "Cette proposition n’est plus payable.");
      if (current.stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(
          current.stripeSessionId,
        );
        if (session.status === "open" && session.url) return session.url;
        if (session.status === "complete")
          throw new HttpError(
            409,
            "Votre paiement est en cours de confirmation.",
          );
      }
      const offer = offerFor(current.planId);
      const snapshot = current.offerSnapshot as QuoteSnapshot & { name?: string };
      if (snapshot.publicQuote?.version === TTC_QUOTE_VERSION && !isInclusiveQuote(snapshot))
        throw new HttpError(409, "La base TTC de cette proposition doit être vérifiée avant paiement.");
      const versionedQuote = isPublicQuote(snapshot);
      const offerName = versionedQuote && snapshot.name ? snapshot.name : offer.name;
      const termsVersion = versionedQuote ? "2026-09-11" : TERMS_VERSION;
      const item = (
        amount: number,
        name: string,
        recurring = false,
      ): Stripe.Checkout.SessionCreateParams.LineItem => ({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amount,
          tax_behavior: isInclusiveQuote(snapshot) ? "inclusive" : "exclusive",
          product_data: { name },
          ...(recurring ? { recurring: { interval: "month" as const } } : {}),
        },
      });
      const attempt = current.checkoutAttempt + 1;
      const session = await stripe.checkout.sessions.create(
        {
          mode: current.monthlyCents ? "subscription" : "payment",
          customer_email: current.email,
          client_reference_id: current.id,
          metadata: { projectId: current.id, termsVersion, taxBasis: quoteTaxLabel(snapshot), ...(versionedQuote ? { quoteVersion: snapshot.publicQuote!.version! } : {}) },
          ...(current.monthlyCents
            ? { subscription_data: { metadata: { projectId: current.id } } }
            : { invoice_creation: { enabled: true } }),
          line_items: [
            item(current.setupCents, `${offerName} — création du site`),
            ...(current.monthlyCents
              ? [
                  item(
                    current.monthlyCents,
                    `${offerName} — ${versionedQuote ? "options mensuelles" : "abonnement mensuel"}`,
                    true,
                  ),
                ]
              : []),
          ],
          billing_address_collection: "required",
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          payment_method_types: ["card"],
          locale: "fr",
          success_url: `${marketingUrl()}/espace-projet/?paiement=retour`,
          cancel_url: `${marketingUrl()}/espace-projet/?paiement=annule`,
        },
        { idempotencyKey: `checkout:${current.id}:${attempt}` },
      );
      if (!session.url)
        throw new HttpError(502, "Le paiement n’a pas pu être ouvert.");
      await tx.salesProject.update({
        where: { id: current.id },
        data: {
          stripeSessionId: session.id,
          checkoutAttempt: attempt,
          termsAcceptedAt: new Date(),
          termsVersion,
        },
      });
      await tx.automationEvent.create({
        data: {
          projectId: current.id,
          type: "TERMS_ACCEPTED",
          detail: `Proposition ${current.quoteReference}, conditions ${termsVersion}, création ${current.setupCents} centimes ${quoteTaxLabel(snapshot)}, mensualité ${current.monthlyCents} centimes ${quoteTaxLabel(snapshot)}.`,
        },
      });
      return session.url;
    },
    { timeout: 30000 },
  );
}

export async function applyStripeEvent(
  stripe: Stripe,
  stripeEvent: Stripe.Event,
) {
  const checkoutEvent = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ].includes(stripeEvent.type);
  const subscriptionEvent = [
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ].includes(stripeEvent.type);
  if (!checkoutEvent && !subscriptionEvent) return;
  let session: Stripe.Checkout.Session | null = null;
  let subscription: Stripe.Subscription | null = null;
  let projectId: string | undefined;
  if (checkoutEvent) {
    const received = stripeEvent.data.object as Stripe.Checkout.Session;
    session = await stripe.checkout.sessions.retrieve(received.id);
    if (session.payment_status !== "paid") return;
    projectId = session.metadata?.projectId;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (subscriptionId)
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } else {
    const object = stripeEvent.data.object;
    const id =
      object.object === "subscription"
        ? object.id
        : (object as Stripe.Invoice).parent?.subscription_details?.subscription;
    const subscriptionId = typeof id === "string" ? id : id?.id;
    if (!subscriptionId) return;
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    projectId = subscription.metadata.projectId;
  }
  if (!projectId) return;
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SalesProject" WHERE id = ${projectId} FOR UPDATE`;
      if (
        await tx.automationEvent.findUnique({
          where: { externalId: stripeEvent.id },
        })
      )
        return;
      const project = await tx.salesProject.findUnique({
        where: { id: projectId },
      });
      if (!project) return;
      if (session) {
        if (
          session.id !== project.stripeSessionId ||
          session.currency !== "eur" ||
          (isInclusiveQuote(project.offerSnapshot as QuoteSnapshot) ? session.amount_total : session.amount_subtotal) !== project.setupCents + project.monthlyCents
        )
          throw new Error("Checkout does not match the approved project");
        if (!project.paidAt) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id;
          const paymentStatus =
            !subscription || subscription.status === "active"
              ? "PAID"
              : subscription.status === "canceled"
                ? "CANCELED"
                : "PAST_DUE";
          await tx.salesProject.update({
            where: { id: project.id },
            data: {
              paidAt: new Date(),
              paymentStatus,
              stage: "BRIEF",
              stripeSubscriptionId: subId,
              stripeCustomerId: customerId,
            },
          });
          if (project.prospectId) {
            await tx.prospect.update({
              where: { id: project.prospectId },
              data: {
                status: "CLIENT_SIGNE",
                signedValue: project.setupCents / 100,
              },
            });
            await tx.followUp.updateMany({
              where: { prospectId: project.prospectId, status: "PENDING" },
              data: { status: "DONE", doneAt: new Date() },
            });
          }
          await tx.automationMessage.upsert({
            where: { dedupeKey: `paid:${project.id}` },
            update: {},
            create: {
              dedupeKey: `paid:${project.id}`,
              projectId: project.id,
              to: project.email,
              subject: "Paiement reçu : préparons votre site",
              text: "Votre paiement FLEX-WEB est confirmé. Complétez votre brief dans l’espace privé accessible via le lien de notre premier message. Le délai de réalisation commence après validation du brief complet.\n\ncontact@flex-web.fr",
            },
          });
        }
      } else if (
        subscription &&
        project.paidAt &&
        project.stripeSubscriptionId === subscription.id &&
        stripeEvent.created >= project.stripeUpdatedAt
      ) {
        const state =
          subscription.status === "active"
            ? "PAID"
            : subscription.status === "canceled"
              ? "CANCELED"
              : "PAST_DUE";
        await tx.salesProject.update({
          where: { id: project.id },
          data: { paymentStatus: state, stripeUpdatedAt: stripeEvent.created },
        });
        if (project.organizationId)
          await tx.subscription.updateMany({
            where: {
              organizationId: project.organizationId,
              externalId: subscription.id,
            },
            data: {
              status:
                state === "PAID"
                  ? "ACTIVE"
                  : state === "CANCELED"
                    ? "CANCELED"
                    : "PAST_DUE",
            },
          });
      }
      await tx.automationEvent.create({
        data: {
          externalId: stripeEvent.id,
          projectId: project.id,
          type: stripeEvent.type,
          detail: "Événement Stripe vérifié et traité.",
        },
      });
    },
    { timeout: 15000 },
  );
}
