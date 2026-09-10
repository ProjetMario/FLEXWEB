import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { prisma } from "../lib/prisma";
import {
  createSite,
  ownSite,
  saveSite,
  publishSite,
} from "../lib/studio/service";
import {
  baseDraft,
  briefSchema,
  DAY,
  visible,
  paid,
  snapshot,
  publicationErrors,
} from "../lib/studio/core";
import {
  enqueueGeneration,
  processGeneration,
  expireJobs,
} from "../lib/studio/jobs";
import {
  checkout,
  refreshSubscription,
  applyStudioStripeEvent,
} from "../lib/studio/payments";
if (
  process.env.AUTOMATION_TEST_DATABASE !== "true" ||
  new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1"
)
  throw Error("Use isolated test harness");
after(() => prisma.$disconnect());
beforeEach(async () => {
  await prisma.studioJob.deleteMany();
  await prisma.studioAsset.deleteMany();
  await prisma.studioInquiry.deleteMany();
  await prisma.studioEvent.deleteMany();
  await prisma.studioSite.deleteMany();
  await prisma.studioBudget.deleteMany();
  process.env.STUDIO_AI_ENABLED = "true";
  process.env.STUDIO_PAYMENTS_ENABLED = "false";
});
const identity = () => ({
  id: randomUUID(),
  email: `${randomUUID()}@example.test`,
});
const brief = () =>
  briefSchema.parse({
    company: "Atelier " + randomUUID().slice(0, 8),
    activity: "Menuiserie",
    city: "Lyon",
    description: "Une entreprise de menuiserie pour vos projets de rénovation.",
    services: "Pose de fenêtres et portes",
    about: "Présentation fournie par le client.",
    phone: "+33612345678",
    email: "atelier@example.test",
    area: "Lyon et environs",
    color: "#245947",
    theme: "atelier",
    legalName: "Atelier Test SARL",
    address: "10 rue du Test, Lyon",
    siren: "123456789",
    legalForm: "SARL",
    contactName: "Responsable Test",
    logoId: "",
  });
async function setup() {
  const user = identity();
  return { user, site: await createSite(user, brief()) };
}
async function activate(id: string) {
  return prisma.studioSite.update({
    where: { id },
    data: {
      billingStatus: "ACTIVE",
      paidThrough: new Date(Date.now() + 30 * DAY),
    },
  });
}
test("verified identity owns one private trial, repeat intake does not extend it", async () => {
  const { user, site } = await setup();
  const again = await createSite(user, { ...brief(), company: "Other" });
  assert.equal(site.id, again.id);
  assert.equal(site.trialEndsAt.getTime(), again.trialEndsAt.getTime());
  assert.equal(visible(site), false);
  assert.equal(site.published, null);
  assert.equal(await prisma.studioJob.count(), 0);
  await assert.rejects(ownSite(identity()), /Créez/);
});
test("CRM linkage requires verified email and preserves a previous opposition", async () => {
  const user = identity();
  const p = await prisma.prospect.create({
    data: {
      companyName: "Existing",
      phone: "",
      email: user.email,
      doNotContactAt: new Date(),
      status: "PAS_INTERESSE",
    },
  });
  const s = await createSite(user, brief());
  assert.equal(s.prospectId, p.id);
  assert.ok(
    (await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } }))
      .doNotContactAt,
  );
});
test("editing checks revision, trial expiry and cross-tenant asset ownership", async () => {
  const { user, site } = await setup();
  const other = await setup();
  const asset = await prisma.studioAsset.create({
    data: {
      siteId: other.site.id,
      key: randomUUID(),
      bytes: 5,
      state: "READY",
    },
  });
  await assert.rejects(
    saveSite(user, {
      brief: { ...brief(), logoId: asset.id },
      draft: baseDraft(brief()),
      revision: 1,
    }),
    /n’appartient/,
  );
  await saveSite(user, {
    brief: brief(),
    draft: baseDraft(brief()),
    revision: 1,
  });
  await assert.rejects(
    saveSite(user, { brief: brief(), draft: baseDraft(brief()), revision: 1 }),
    /modification/,
  );
  await prisma.studioSite.update({
    where: { id: site.id },
    data: { trialEndsAt: new Date(0) },
  });
  await assert.rejects(
    saveSite(user, { brief: brief(), draft: baseDraft(brief()), revision: 2 }),
    /essai est terminé/,
  );
});
test("concurrent AI requests reserve budget once and do not exceed the trial quota", async () => {
  const { user, site } = await setup();
  const key = randomUUID();
  const jobs = await Promise.all([
    enqueueGeneration(user, { requestKey: key, revision: 1 }),
    enqueueGeneration(user, { requestKey: key, revision: 1 }),
  ]);
  assert.equal(jobs[0].id, jobs[1].id);
  assert.equal(
    (await prisma.studioBudget.findFirstOrThrow()).reservedCents,
    25,
  );
  for (let n = 0; n < 3; n++) {
    if (n > 0)
      await enqueueGeneration(user, {
        requestKey: randomUUID(),
        revision: n + 1,
      });
    await processGeneration(async () => ({
      content: baseDraft(brief()),
      inputTokens: 50,
      outputTokens: 100,
    }));
  }
  await assert.rejects(
    enqueueGeneration(user, { requestKey: randomUUID(), revision: 4 }),
    /quota/,
  );
  assert.equal((await ownSite(user)).published, null);
  assert.equal((await ownSite(user)).draftRevision, 4);
  assert.equal(
    await prisma.studioJob.count({ where: { siteId: site.id, state: "DONE" } }),
    3,
  );
});
test("global budget rejects a new reservation at 50 euros without consuming quota", async () => {
  const { user } = await setup();
  await prisma.studioBudget.create({
    data: { period: new Date().toISOString().slice(0, 7), reservedCents: 5000 },
  });
  await assert.rejects(
    enqueueGeneration(user, { requestKey: randomUUID(), revision: 1 }),
    /temporairement/,
  );
  assert.equal(await prisma.studioJob.count(), 0);
});
test("worker claims a job once and preserves concurrent manual edits", async () => {
  const { user } = await setup();
  await enqueueGeneration(user, { requestKey: randomUUID(), revision: 1 });
  let calls = 0;
  const generator = async () => {
    calls++;
    await saveSite(user, {
      brief: brief(),
      draft: { ...baseDraft(brief()), tagline: "Manual content" },
      revision: 1,
    });
    return { content: baseDraft(brief()), inputTokens: 1, outputTokens: 1 };
  };
  await Promise.all([
    processGeneration(generator),
    processGeneration(generator),
  ]);
  assert.equal(calls, 1);
  assert.equal(snapshot(await ownSite(user)).content.tagline, "Manual content");
  assert.equal((await prisma.studioJob.findFirstOrThrow()).state, "FAILED");
});
test("malformed AI output never replaces a draft and no unsafe HTML is executed", async () => {
  const { user } = await setup();
  await enqueueGeneration(user, { requestKey: randomUUID(), revision: 1 });
  await processGeneration(async () => ({
    content: { pages: [] },
    inputTokens: 1,
    outputTokens: 1,
  }));
  assert.equal((await ownSite(user)).draftRevision, 1);
  assert.equal((await prisma.studioJob.findFirstOrThrow()).state, "FAILED");
});
test("publication needs payment, legal details and current revision; restoration keeps snapshots", async () => {
  const { user, site } = await setup();
  await assert.rejects(publishSite(site.id, 1), /abonnement/);
  assert.ok(
    publicationErrors({ ...brief(), siren: "" }, baseDraft(brief())).length,
  );
  await activate(site.id);
  await publishSite(site.id, 1);
  assert.ok(visible(await ownSite(user)));
  const first = snapshot(await ownSite(user)).content.tagline;
  await saveSite(user, {
    brief: brief(),
    draft: { ...baseDraft(brief()), tagline: "Second version" },
    revision: 1,
  });
  assert.equal((await ownSite(user)).draftRevision, 2);
  await assert.rejects(publishSite(site.id, 1), /contenu a changé/);
  await publishSite(site.id, 2);
  await publishSite(site.id, 2, true);
  assert.equal(snapshot(await ownSite(user)).content.tagline, first);
});
test("past due grace period, cancellation and trial expiry do not erase content", async () => {
  const { user, site } = await setup();
  await activate(site.id);
  await publishSite(site.id, 1);
  let s = await prisma.studioSite.update({
    where: { id: site.id },
    data: {
      billingStatus: "PAST_DUE",
      pastDueAt: new Date(Date.now() - 6 * DAY),
    },
  });
  assert.ok(paid(s));
  s = await prisma.studioSite.update({
    where: { id: site.id },
    data: { pastDueAt: new Date(Date.now() - 8 * DAY) },
  });
  assert.equal(visible(s), false);
  await expireJobs();
  assert.equal((await ownSite(user)).state, "SUSPENDED");
  assert.ok((await ownSite(user)).published);
});
test("checkout is disabled by default and reuses the same billable session", async () => {
  const { user } = await setup();
  await assert.rejects(checkout(user, 1, true), /vérification/);
  process.env.STUDIO_PAYMENTS_ENABLED = "true";
  let creates = 0;
  const stripe = {
    checkout: {
      sessions: {
        create: async (p: Stripe.Checkout.SessionCreateParams) => {
          creates++;
          assert.equal(p.line_items?.[0].price_data?.unit_amount, 4900);
          assert.equal(p.line_items?.length, 1);
          return {
            id: "cs_test_studio",
            url: "https://checkout.stripe.com/test",
          };
        },
        retrieve: async () => ({
          id: "cs_test_studio",
          status: "open",
          url: "https://checkout.stripe.com/test",
        }),
      },
    },
  } as unknown as Stripe;
  await checkout(user, 1, true, stripe);
  await checkout(user, 1, true, stripe);
  assert.equal(creates, 1);
});
test("authoritative Stripe status publishes once, restores after recovery and repeated events are safe", async () => {
  const { user, site } = await setup();
  await prisma.studioSite.update({
    where: { id: site.id },
    data: { stripeSessionId: "cs_test", approvedRevision: 1 },
  });
  let status = "active";
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        id: "sub_test",
        metadata: { studioSiteId: site.id },
        status,
        cancel_at_period_end: false,
        items: {
          data: [
            { current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 },
          ],
        },
      }),
    },
  } as unknown as Stripe;
  const event = {
    id: "evt_studio",
    type: "checkout.session.completed",
    data: {
      object: {
        object: "checkout.session",
        id: "cs_test",
        metadata: { studioSiteId: site.id },
        payment_status: "paid",
        subscription: "sub_test",
        customer: "cus_test",
      },
    },
  } as unknown as Stripe.Event;
  await applyStudioStripeEvent(stripe, event);
  await applyStudioStripeEvent(stripe, event);
  assert.equal((await ownSite(user)).state, "LIVE");
  assert.equal(
    await prisma.studioEvent.count({ where: { key: "stripe:evt_studio" } }),
    1,
  );
  status = "past_due";
  await refreshSubscription(site.id, stripe);
  await prisma.studioSite.update({
    where: { id: site.id },
    data: { state: "SUSPENDED" },
  });
  await prisma.website.update({ where: { id: site.websiteId }, data: { isPublished: false } });
  status = "active";
  await refreshSubscription(site.id, stripe);
  assert.equal((await ownSite(user)).state, "LIVE");
  assert.equal((await prisma.website.findUniqueOrThrow({ where: { id: site.websiteId } })).isPublished, true);
});

test("a delayed checkout event cannot replace a newer subscription", async () => {
  const { user, site } = await setup();
  await prisma.studioSite.update({
    where: { id: site.id },
    data: { stripeSessionId: "cs_current", stripeSubscriptionId: "sub_current" },
  });
  const stripe = { subscriptions: { retrieve: async () => { throw Error("Stale checkout must not trigger subscription lookup"); } } } as unknown as Stripe;
  const event = {
    id: "evt_delayed", type: "checkout.session.completed",
    data: { object: { object: "checkout.session", id: "cs_previous",
      metadata: { studioSiteId: site.id }, payment_status: "paid",
      subscription: "sub_previous", customer: "cus_previous" } },
  } as unknown as Stripe.Event;
  assert.equal(await applyStudioStripeEvent(stripe, event), true);
  const current = await ownSite(user);
  assert.equal(current.stripeSubscriptionId, "sub_current");
  assert.equal(current.stripeSessionId, "cs_current");
  assert.equal(current.state, "TRIAL");
});
