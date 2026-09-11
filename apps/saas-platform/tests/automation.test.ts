import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import {
  intakeSchema,
  briefSchema,
  newToken,
  tokenHash,
  secretMatches,
  projectedMrr,
  publicQuoteSchema,
  offerForIntake,
} from "../lib/automation/core";
import {
  createIntake,
  getProject,
  submitBrief,
  generateDraft,
  publicProject,
  rateLimit,
} from "../lib/automation/service";
import { manageProject, deleteUnpaidProject } from "../lib/automation/admin";
import { startCheckout, applyStripeEvent } from "../lib/automation/payments";
import { runAutomation } from "../lib/automation/jobs";
import { POST as automationApi } from "../app/api/automation/[action]/route";
import { POST as webhook } from "../app/api/stripe/webhook/route";
if (
  process.env.AUTOMATION_TEST_DATABASE !== "true" ||
  new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1"
)
  throw Error("Use the isolated test harness");
after(async () => {
  await prisma.$disconnect();
});
const intake = () => ({
  requestKey: randomUUID(),
  accessToken: newToken(),
  companyName: `Atelier ${randomUUID().slice(0, 8)}`,
  contactName: "Camille Martin",
  email: "camille@example.test",
  phone: "0612345678",
  city: "Chambéry",
  businessType: "Menuiserie",
  planId: "croissance" as const,
  message: "Je souhaite présenter mes prestations de menuiserie.",
  timeline: "rapidement" as const,
  privacyConsent: true as const,
  professional: true as const,
  websiteTrap: "",
  source: "test",
});
const brief = {
  description:
    "Nous réalisons des prestations de menuiserie pour les particuliers autour de Chambéry.",
  services: ["Aménagement intérieur", "Portes et fenêtres"],
  area: "Chambéry et alentours",
  advantages: "Des réalisations adaptées à vos besoins.",
  about:
    "Notre atelier accompagne les particuliers dans leurs projets de menuiserie.",
  contactEmail: "atelier@example.test",
  phone: "0612345678",
  assetLink: "",
  color: "#0071e3",
  contentConfirmed: true as const,
};
const actionContext = (action: string) => ({
  params: Promise.resolve({ action }),
});

test("unpaid requests can be removed without deleting payment or commercial history", async () => {
  const p = await createIntake(intake());
  await assert.rejects(deleteUnpaidProject(p.id, "Wrong company"));
  assert.ok(await prisma.salesProject.findUnique({ where: { id: p.id } }));
  await prisma.prospectNote.create({ data: { prospectId: p.prospectId!, content: "Historique à conserver" } });
  await deleteUnpaidProject(p.id, p.companyName);
  assert.equal(await prisma.salesProject.findUnique({ where: { id: p.id } }), null);
  assert.equal(await prisma.automationMessage.count({ where: { projectId: p.id } }), 0);
  assert.ok(await prisma.prospect.findUnique({ where: { id: p.prospectId! } }));
  const empty = await createIntake(intake());
  await deleteUnpaidProject(empty.id, empty.companyName);
  assert.equal(await prisma.prospect.findUnique({ where: { id: empty.prospectId! } }), null);
  const committed = await createIntake(intake());
  await prisma.salesProject.update({ where: { id: committed.id }, data: { stripeSessionId: "cs_test_retained" } });
  await assert.rejects(deleteUnpaidProject(committed.id, committed.companyName));
  await prisma.salesProject.update({ where: { id: committed.id }, data: { stripeSessionId: null, paymentStatus: "PAID", paidAt: new Date() } });
  await assert.rejects(deleteUnpaidProject(committed.id, committed.companyName));
});
const request = (body: unknown, token?: string) =>
  new Request("http://localhost/api/automation/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-automation-secret": "a".repeat(64),
      "x-visitor-key": "b".repeat(64),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

test("public quote selection derives prices and rejects caller-defined money", () => {
  assert.equal(publicQuoteSchema.safeParse({ version: "2026-09-11", service: "site", tier: "simple", options: [], setupCents: 1 }).success, false);
  assert.equal(publicQuoteSchema.safeParse({ version: "2026-09-11", service: "site", tier: "simple", options: ["crm", "crm"] }).success, false);
  assert.equal(publicQuoteSchema.safeParse({ version: "unknown", service: "site", tier: "simple", options: [] }).success, false);
  assert.equal(publicQuoteSchema.safeParse({ version: "2026-09-11", service: "application", tier: "simple" }).success, false);
  const input = intakeSchema.parse({ ...intake(), setupCents: 1, monthlyCents: 1, publicQuote: { version: "2026-09-11", service: "site", tier: "simple", options: [] } });
  const offer = offerForIntake(input);
  assert.equal(publicQuoteSchema.safeParse({ version: "2026-09-11-ttc", service: "site", tier: "simple", options: [], taxBasis: "HT" }).success, false);
  assert.equal(offer.setupCents, 29900);
  assert.equal(offer.monthlyCents, 0);
  assert.equal(offer.id, "essentielle");
  const legacy = offerForIntake(intakeSchema.parse(intake()));
  assert.equal(legacy.setupCents, 99000);
  assert.equal(legacy.monthlyCents, 29900);
  assert.equal("publicQuote" in legacy, false);
});

test("versioned quote snapshots and Stripe mock preserve every optional-price combination", async () => {
  const previousPayments = process.env.AUTOMATION_PAYMENTS_ENABLED;
  process.env.AUTOMATION_PAYMENTS_ENABLED = "true";
  try {
    for (const tier of ["simple", "complete"] as const) {
      for (const options of [[], ["maintenance"], ["crm"], ["maintenance", "crm"]] as const) {
        const selection = { version: "2026-09-11", service: "site", tier, options: [...options] };
        const data = { ...intake(), publicQuote: selection };
        const project = await createIntake(data);
        const setupCents = tier === "simple" ? 29900 : 99000;
        const monthlyCents = (options as readonly string[]).reduce((sum, option) => sum + (option === "maintenance" ? 4900 : 9900), 0);
        assert.equal(project.setupCents, setupCents);
        assert.equal(project.monthlyCents, monthlyCents);
        assert.equal(project.planId, tier === "simple" ? "essentielle" : "achat");
        const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: project.prospectId! } });
        assert.equal(prospect.setupFee, setupCents / 100);
        assert.equal(prospect.monthlyPrice, monthlyCents / 100);
        const replay = await createIntake({ ...data, publicQuote: { ...selection, options: [] } });
        assert.equal(replay.id, project.id);
        assert.deepEqual(replay.offerSnapshot, project.offerSnapshot);
        const form = new FormData();
        form.set("scopeConfirmed", "on");
        await manageProject(project.id, "qualify", form);
        const qualified = await getProject(data.accessToken);
        let calls = 0;
        let params: Stripe.Checkout.SessionCreateParams | undefined;
        const session = { id: `cs_public_quote_${randomUUID()}`, status: "open", url: "https://checkout.stripe.com/local-test" };
        const stripeMock = { checkout: { sessions: {
          create: async (value: Stripe.Checkout.SessionCreateParams) => { calls++; params = value; return session; },
          retrieve: async () => session,
        } } } as unknown as Stripe;
        await Promise.all([startCheckout(qualified, true, stripeMock), startCheckout(qualified, true, stripeMock)]);
        assert.equal(calls, 1);
        assert(params!.line_items!.every(item => item.price_data!.tax_behavior === "exclusive"));
        assert.equal(params!.mode, monthlyCents ? "subscription" : "payment");
        assert.equal(params!.line_items![0].price_data!.unit_amount, setupCents);
        assert.equal(params!.line_items!.length, monthlyCents ? 2 : 1);
        if (monthlyCents) assert.equal(params!.line_items![1].price_data!.unit_amount, monthlyCents);
        assert.equal(params!.line_items![0].price_data!.product_data!.name, `${tier === "simple" ? "Site vitrine simple" : "Site vitrine complet"} — création du site`);
        assert.equal(params!.metadata!.termsVersion, "2026-09-11");
      }
    }
  } finally {
    if (previousPayments === undefined) delete process.env.AUTOMATION_PAYMENTS_ENABLED;
    else process.env.AUTOMATION_PAYMENTS_ENABLED = previousPayments;
  }
});

test("TTC catalogue uses inclusive prices, validates gross paid total, and preserves snapshots", async () => {
  const previousPayments = process.env.AUTOMATION_PAYMENTS_ENABLED;
  process.env.AUTOMATION_PAYMENTS_ENABLED = "true";
  try {
    for (const tier of ["simple", "complete"] as const) {
      for (const options of [[], ["maintenance"], ["crm"], ["maintenance", "crm"]] as const) {
        const selection = { version: "2026-09-11-ttc", service: "site", tier, options: [...options] };
        const data = { ...intake(), publicQuote: selection };
        const project = await createIntake(data);
        const setupCents = tier === "simple" ? 29900 : 99000;
        const monthlyCents = (options as readonly string[]).reduce((sum, option) => sum + (option === "maintenance" ? 4900 : 9900), 0);
        assert.equal(project.setupCents, setupCents);
        assert.equal(project.monthlyCents, monthlyCents);
        assert.equal(project.planId, tier === "simple" ? "essentielle" : "achat");
        const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: project.prospectId! } });
        assert.equal(prospect.setupFee, setupCents / 100);
        assert.equal(prospect.monthlyPrice, monthlyCents / 100);
        const replay = await createIntake({ ...data, publicQuote: { ...selection, options: [] } });
        assert.equal(replay.id, project.id);
        assert.deepEqual(replay.offerSnapshot, project.offerSnapshot);
        const form = new FormData();
        form.set("scopeConfirmed", "on");
        await manageProject(project.id, "qualify", form);
        const qualified = await getProject(data.accessToken);
        let calls = 0;
        let params: Stripe.Checkout.SessionCreateParams | undefined;
        const session = { currency: "eur", amount_subtotal: Math.round((setupCents + monthlyCents) / 1.2), amount_total: setupCents + monthlyCents, payment_status: "unpaid", metadata: { projectId: project.id }, id: `cs_public_quote_${randomUUID()}`, status: "open", url: "https://checkout.stripe.com/local-test" };
        const stripeMock = { checkout: { sessions: {
          create: async (value: Stripe.Checkout.SessionCreateParams) => { calls++; params = value; return session; },
          retrieve: async () => session,
        } } } as unknown as Stripe;
        await Promise.all([startCheckout(qualified, true, stripeMock), startCheckout(qualified, true, stripeMock)]);
        assert.equal(calls, 1);
        assert.equal(params!.mode, monthlyCents ? "subscription" : "payment");
        assert.equal(params!.line_items![0].price_data!.unit_amount, setupCents);
        assert.equal(params!.line_items!.length, monthlyCents ? 2 : 1);
        if (monthlyCents) assert.equal(params!.line_items![1].price_data!.unit_amount, monthlyCents);
        assert.equal(params!.line_items![0].price_data!.product_data!.name, `${tier === "simple" ? "Site vitrine simple" : "Site vitrine complet"} — création du site`);
        assert.equal(params!.metadata!.termsVersion, "2026-09-11");
        assert.equal(params!.metadata!.taxBasis, "TTC");
        assert.equal((project.offerSnapshot as { taxBasis: string }).taxBasis, "TTC");
        assert(params!.line_items!.every(item => item.price_data!.tax_behavior === "inclusive"));
        session.status = "complete";
        session.payment_status = "paid";
        const paidEvent = { id: `evt_ttc_${randomUUID()}`, type: "checkout.session.completed", created: Math.floor(Date.now()/1000), data: { object: session } } as unknown as Stripe.Event;
        session.amount_total--;
        await assert.rejects(applyStripeEvent(stripeMock, paidEvent), /does not match/);
        assert.equal((await getProject(data.accessToken)).paymentStatus, "UNPAID");
        session.amount_total++;
        await applyStripeEvent(stripeMock, paidEvent);
        await applyStripeEvent(stripeMock, paidEvent);
        const paid = await getProject(data.accessToken);
        assert.equal(paid.paymentStatus, "PAID");
        assert.equal(paid.stage, "BRIEF");
        assert.equal(await prisma.automationEvent.count({ where: { externalId: paidEvent.id } }), 1);
      }
    }
  } finally {
    if (previousPayments === undefined) delete process.env.AUTOMATION_PAYMENTS_ENABLED;
    else process.env.AUTOMATION_PAYMENTS_ENABLED = previousPayments;
  }
});

test("bespoke IA and application requests cannot qualify or create a checkout", async () => {
  for (const service of ["automation", "application"] as const) {
    const project = await createIntake({ ...intake(), publicQuote: { version: "2026-09-11-ttc", service } });
    assert.equal(project.setupCents, 0);
    assert.equal(project.monthlyCents, 0);
    assert.equal((project.offerSnapshot as { quoteOnly: boolean }).quoteOnly, true);
    const form = new FormData();
    form.set("scopeConfirmed", "on");
    await assert.rejects(manageProject(project.id, "qualify", form), /devis sur mesure/);
    await assert.rejects(startCheckout(project, true), /devis sur mesure/);
    assert.equal((await publicProject(project)).checkoutAvailable, false);
    const saved = await prisma.salesProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(saved.stage, "NEW");
    assert.equal(saved.stripeSessionId, null);
    assert.equal(await prisma.automationMessage.count({ where: { dedupeKey: `quote:${project.id}` } }), 0);
  }
});

test("validation, pricing, token security and negative MRR cases", () => {
  assert.equal(
    intakeSchema.safeParse({ ...intake(), privacyConsent: false }).success,
    false,
  );
  assert.equal(
    intakeSchema.safeParse({ ...intake(), planId: "invented" }).success,
    false,
  );
  assert.equal(
    briefSchema.safeParse({ ...brief, assetLink: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(secretMatches("a".repeat(64), "a".repeat(64)), true);
  assert.equal(secretMatches("a", "a"), false);
  assert.equal(
    projectedMrr([
      { monthlyCents: 29900, paymentStatus: "PAID", stage: "LIVE" },
      { monthlyCents: 9900, paymentStatus: "PAST_DUE", stage: "LIVE" },
      { monthlyCents: 29900, paymentStatus: "PAID", stage: "CANCELED" },
    ]),
    29900,
  );
});

test("owner initialization requires the shared secret and cannot overwrite an account", async () => {
  const {initializeOwner} = await import("../lib/automation/owner");
  await assert.rejects(()=>initializeOwner({email:"owner@example.test",password:"weak"}));
  const owners=await Promise.allSettled([
    initializeOwner({email:"owner@example.test",password:"a-secure-local-test-password-42"}),
    initializeOwner({email:"other@example.test",password:"another-secure-test-password-42"})
  ]);
  assert.equal(owners.filter(x=>x.status==="fulfilled").length,1, owners.filter(x=>x.status==="rejected").map(x=>x.reason.message).join("; "));
  assert.equal(await prisma.user.count(),1);
  assert.equal(await prisma.membership.count({where:{role:"SUPER_ADMIN"}}),1);
  const denied=await automationApi(new Request("http://localhost/api/automation/initialize-owner",{method:"POST",body:"{}"}),actionContext("initialize-owner"));
  assert.equal(denied.status,401);
});

test("intake is atomic and idempotent; private token cannot be replaced", async () => {
  const data = intake();
  const rows = await Promise.all([createIntake(data), createIntake(data)]);
  assert.equal(rows[0].id, rows[1].id);
  assert.equal(
    await prisma.salesProject.count({ where: { requestKey: data.requestKey } }),
    1,
  );
  assert.equal(
    await prisma.followUp.count({ where: { prospectId: rows[0].prospectId! } }),
    1,
  );
  assert.equal(
    await prisma.automationMessage.count({ where: { projectId: rows[0].id } }),
    1,
  );
  await assert.rejects(() =>
    createIntake({ ...data, accessToken: newToken() }),
  );
  await assert.rejects(() => getProject(newToken()));
  assert.equal((await getProject(data.accessToken)).id, rows[0].id);
  assert.notEqual(rows[0].accessTokenHash, data.accessToken);
  const exposed = await publicProject(rows[0]);
  assert.equal("accessTokenHash" in exposed, false);
  await assert.rejects(() => submitBrief(rows[0], brief));
});

test("requests without shared authentication and forged webhooks are rejected", async () => {
  const unauth = await automationApi(
    new Request("http://localhost/api/automation/intake", {
      method: "POST",
      body: "{}",
    }),
    actionContext("intake"),
  );
  assert.equal(unauth.status, 401);
  process.env.STRIPE_SECRET_KEY = "sk_test_local";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_local";
  const result = await webhook(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "forged" },
      body: "{}",
    }),
  );
  assert.equal(result.status, 400);
});

test("checkout, duplicate events, draft, review, corrections, approval and guarded publication", async () => {
  const data = intake();
  const created = await createIntake(data);
  await assert.rejects(() => startCheckout(created, true));
  const form = new FormData();
  form.set("scopeConfirmed", "on");
  await manageProject(created.id, "qualify", form);
  const project = await getProject(data.accessToken);
  assert.equal(project.stage, "AWAITING_PAYMENT");
  process.env.AUTOMATION_PAYMENTS_ENABLED = "true";
  let calls = 0;
  let params: Stripe.Checkout.SessionCreateParams | undefined;
  const session = {
    id: `cs_${randomUUID()}`,
    status: "open",
    payment_status: "unpaid",
    currency: "eur",
    amount_subtotal: 128900,
    customer: "cus_local",
    subscription: "sub_" + randomUUID(),
    url: "https://checkout.stripe.com/test",
    metadata: { projectId: project.id },
  };
  const fake = {
    checkout: {
      sessions: {
        create: async (p: Stripe.Checkout.SessionCreateParams) => {
          calls++;
          params = p;
          return session;
        },
        retrieve: async () => session,
      },
    },
    subscriptions: {
      retrieve: async () => ({
        id: session.subscription,
        status: "active",
        metadata: { projectId: project.id },
      }),
    },
  } as unknown as Stripe;
  const urls = await Promise.all([
    startCheckout(project, true, fake),
    startCheckout(project, true, fake),
  ]);
  assert.equal(calls, 1);
  assert.equal(urls[0], urls[1]);
  assert.equal(params?.line_items?.[0].price_data?.unit_amount, 99000);
  assert.equal(params?.line_items?.[1].price_data?.unit_amount, 29900);
  assert.equal(params?.automatic_tax?.enabled, true);
  assert.ok(!params?.success_url?.includes(data.accessToken));
  const event = {
    id: `evt_${randomUUID()}`,
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: { object: session },
  } as unknown as Stripe.Event;
  await applyStripeEvent(fake, event);
  assert.equal((await getProject(data.accessToken)).paymentStatus, "UNPAID");
  session.status = "complete";
  session.payment_status = "paid";
  await Promise.all([
    applyStripeEvent(fake, event),
    applyStripeEvent(fake, event),
  ]);
  assert.equal(
    await prisma.automationEvent.count({ where: { externalId: event.id } }),
    1,
  );
  const paid = await getProject(data.accessToken);
  assert.equal(paid.paymentStatus, "PAID");
  assert.equal(paid.stage, "BRIEF");
  await submitBrief(paid, brief);
  await Promise.all([generateDraft(paid.id), generateDraft(paid.id)]);
  let draft = await getProject(data.accessToken);
  assert.equal(draft.stage, "DRAFT_READY");
  assert.equal(
    await prisma.page.count({ where: { websiteId: draft.websiteId! } }),
    5,
  );
  assert.equal(
    (
      await prisma.website.findUniqueOrThrow({
        where: { id: draft.websiteId! },
      })
    ).isPublished,
    false,
  );
  assert.equal((await publicProject(draft)).pages.length, 0);
  const early = await automationApi(
    request({ confirmed: true }, data.accessToken),
    actionContext("approve"),
  );
  assert.equal(early.status, 409);
  const qa = new FormData();
  qa.set("qa", "on");
  await manageProject(draft.id, "review", qa);
  draft = await getProject(data.accessToken);
  assert.equal((await publicProject(draft)).pages.length, 5);
  const correction = {
    requestKey: randomUUID(),
    subject: "Corriger le titre",
    message: "Merci de préciser notre activité principale dans le titre.",
  };
  const asked = await automationApi(
    request(correction, data.accessToken),
    actionContext("support"),
  );
  assert.equal(asked.status, 200);
  assert.equal(
    (await getProject(data.accessToken)).stage,
    "REVISION_REQUESTED",
  );
  const rejectedApproval = await automationApi(
    request({ confirmed: true }, data.accessToken),
    actionContext("approve"),
  );
  assert.equal(rejectedApproval.status, 409);
  const editForm = new FormData();
  const sections = await prisma.pageSection.findMany({
    where: { page: { websiteId: draft.websiteId! } },
  });
  for (const section of sections) {
    const config = section.config as Record<string, string>;
    for (const key of section.type === "header"
      ? ["title", "subtitle"]
      : section.type === "text"
        ? ["content"]
        : section.type === "cta"
          ? ["title", "buttonText", "buttonHref"]
          : [])
      editForm.set(`${section.id}:${key}`, config[key] || "");
  }
  await manageProject(draft.id, "edit", editForm);
  draft = await getProject(data.accessToken);
  assert.equal(draft.qaApprovedAt, null);
  assert.equal(draft.clientApprovedAt, null);
  assert.equal(draft.draftVersion, 2);
  assert.equal((await publicProject(draft)).pages.length, 0);
  await manageProject(draft.id, "review", qa);
  const approved = await automationApi(
    request({ confirmed: true }, data.accessToken),
    actionContext("approve"),
  );
  assert.equal(approved.status, 200);
  await assert.rejects(() =>
    manageProject(draft.id, "publish", new FormData()),
  );
  const publication = new FormData();
  publication.set("publicationChecks", "on");
  await assert.rejects(() => manageProject(draft.id, "publish", publication));
  await prisma.domain.create({
    data: {
      organizationId: draft.organizationId!,
      domain: `${randomUUID()}.example.test`,
      isPrimary: true,
      verifiedAt: new Date(),
      sslConfigured: true,
    },
  });
  await manageProject(draft.id, "publish", publication);
  assert.equal((await getProject(data.accessToken)).stage, "LIVE");
  assert.equal(
    await prisma.page.count({
      where: { websiteId: draft.websiteId!, status: "PUBLISHED" },
    }),
    5,
  );
  let subState = "past_due";
  (fake.subscriptions.retrieve as unknown) = async () => ({
    id: session.subscription,
    object: "subscription",
    status: subState,
    metadata: { projectId: project.id },
  });
  const subscriptionEvent = (created: number) =>
    ({
      id: `evt_${randomUUID()}`,
      type: "customer.subscription.updated",
      created,
      data: { object: { id: session.subscription, object: "subscription" } },
    }) as unknown as Stripe.Event;
  const timestamp = Math.floor(Date.now() / 1000) + 20;
  await applyStripeEvent(fake, subscriptionEvent(timestamp));
  assert.equal((await getProject(data.accessToken)).paymentStatus, "PAST_DUE");
  subState = "active";
  await applyStripeEvent(fake, subscriptionEvent(timestamp - 1));
  assert.equal((await getProject(data.accessToken)).paymentStatus, "PAST_DUE");
  await applyStripeEvent(fake, subscriptionEvent(timestamp + 1));
  assert.equal((await getProject(data.accessToken)).paymentStatus, "PAID");
  subState = "canceled";
  await applyStripeEvent(fake, subscriptionEvent(timestamp + 2));
  assert.equal((await getProject(data.accessToken)).paymentStatus, "CANCELED");
  await applyStripeEvent(fake, {
    ...event,
    id: `evt_${randomUUID()}`,
    created: timestamp + 3,
  });
  assert.equal((await getProject(data.accessToken)).paymentStatus, "CANCELED");
});

test("rate limits persist; mail stays queued while disabled; complete briefs are not reminded", async () => {
  const key = `test:${randomUUID()}`;
  await rateLimit(key, 1);
  await assert.rejects(() => rateLimit(key, 1));
  const before = await prisma.automationMessage.count({
    where: { status: "SENT" },
  });
  const stats = await runAutomation();
  assert.equal(stats.emailEnabled, false);
  assert.equal(stats.sent, 0);
  assert.equal(
    await prisma.automationMessage.count({ where: { status: "SENT" } }),
    before,
  );
  assert.equal(
    await prisma.automationMessage.count({
      where: { dedupeKey: { startsWith: "brief:" } },
    }),
    0,
  );
});

test("Brevo queue sends once, retries rate limits and stops after an ambiguous response", async () => {
  await prisma.automationMessage.updateMany({
    where: { status: "PENDING" },
    data: { status: "SKIPPED" },
  });
  process.env.AUTOMATION_EMAILS_ENABLED = "true";
  process.env.BREVO_API_KEY = "local-brevo-test";
  process.env.EMAIL_FROM = "contact@example.test";
  const message = await prisma.automationMessage.create({
    data: {
      dedupeKey: randomUUID(),
      to: "recipient@example.test",
      subject: "Test local",
      text: "Aucun e-mail réel.",
    },
  });
  let sends = 0;
  const provider = (async (url: unknown, init: RequestInit) => {
    sends++;
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(String(init.body));
    assert.equal(body.sender.email, "contact@example.test");
    assert.equal(body.to[0].email, "recipient@example.test");
    assert.match(body.headers.idempotencyKey, /^[a-f0-9-]{36}$/);
    return Response.json({ messageId: "test-message-id" }, { status: 201 });
  }) as typeof fetch;
  await Promise.all([runAutomation(provider), runAutomation(provider)]);
  assert.equal(sends, 1);
  assert.equal(
    (
      await prisma.automationMessage.findUniqueOrThrow({
        where: { id: message.id },
      })
    ).status,
    "SENT",
  );
  const retry = await prisma.automationMessage.create({
    data: {
      dedupeKey: randomUUID(),
      to: "recipient@example.test",
      subject: "Limite",
      text: "Test",
    },
  });
  await runAutomation((async () =>
    Response.json(
      { code: "too_many_requests" },
      { status: 429 },
    )) as typeof fetch);
  assert.equal(
    (
      await prisma.automationMessage.findUniqueOrThrow({
        where: { id: retry.id },
      })
    ).status,
    "PENDING",
  );
  await prisma.automationMessage.update({
    where: { id: retry.id },
    data: { availableAt: new Date(0) },
  });
  await runAutomation((async () => {
    throw new Error("Connection interrupted");
  }) as typeof fetch);
  assert.equal(
    (
      await prisma.automationMessage.findUniqueOrThrow({
        where: { id: retry.id },
      })
    ).status,
    "FAILED",
  );
  await runAutomation(provider);
  assert.equal(sends, 1);
  process.env.AUTOMATION_EMAILS_ENABLED = "false";
});
