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
