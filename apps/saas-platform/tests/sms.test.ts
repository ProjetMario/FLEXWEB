import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  mobileNumber,
  smsLength,
  isOpposition,
  hash,
  keyMatches,
  ONOFF_NUMBER,
} from "../lib/sms/core";
import {
  createConnectionKeys,
  addContact,
  saveSms,
  claimSms,
  recordOnoff,
  setSmsEnabled,
  stopSms,
  reconcileSms,
} from "../lib/sms/service";
import { smsBlocksEmail } from "../lib/sms/guard";
import { POST as hook } from "../app/api/sms/onoff/route";
import { POST as dispatch } from "../app/api/sms/dispatch/route";
if (
  process.env.AUTOMATION_TEST_DATABASE !== "true" ||
  new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1"
)
  throw Error("Use isolated harness");
after(async () => {
  await prisma.$disconnect();
});
const now = new Date("2026-09-09T10:00:00Z");
let keys: { webhookKey: string; dispatchKey: string };
beforeEach(async () => {
  await prisma.smsOutreachEvent.deleteMany();
  await prisma.smsOutreachMessage.deleteMany();
  await prisma.smsOutreachContact.deleteMany();
  await prisma.smsSuppression.deleteMany();
  await prisma.smsAutomationSettings.deleteMany();
  keys = await createConnectionKeys();
});
function request(path: string, body: unknown, key?: string) {
  return new Request(`https://example.test/api/sms/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "x-api-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function contact(n = 1, approve = true) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    companyName: `Atelier test ${n}`,
    city: "Dolomieu",
    phone: `060000${String(n).padStart(4, "0")}`,
    sourceUrl: "https://example.test/fiche",
    websiteCheckUrl: "https://example.test/recherche",
  }))
    f.set(k, v);
  await addContact(f);
  const c = await prisma.smsOutreachContact.findUniqueOrThrow({
    where: { phone: mobileNumber(String(f.get("phone"))) },
    include: { messages: true },
  });
  await prisma.smsOutreachContact.update({
    where: { id: c.id },
    data: { createdAt: new Date("2026-09-01") },
  });
  if (approve) {
    const review = reviewForm(c.messages[0].body);
    await saveSms(c.id, review, "test-admin");
    await prisma.smsOutreachContact.update({
      where: { id: c.id },
      data: { checkedAt: now },
    });
    await prisma.smsOutreachMessage.update({
      where: { contactId: c.id },
      data: { approvedAt: now },
    });
  }
  return c;
}
function reviewForm(body: string) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    body,
    websiteFinding: "NOT_FOUND",
    contactBasis: "B2B",
    evidence:
      "Test isolé : numéro professionnel, recherche du site et information vérifiés.",
    verified: "on",
    action: "approve",
  }))
    f.set(k, v);
  return f;
}
async function enable() {
  await prisma.smsAutomationSettings.update({
    where: { id: "onoff" },
    data: { webhookVerifiedAt: now, dispatchVerifiedAt: now },
  });
  await setSmsEnabled(true);
}
async function confirmation(
  c: { phone: string },
  text: string,
  id = randomUUID(),
) {
  return recordOnoff({
    id,
    eventName: "SMS",
    onoffUserNumber: ONOFF_NUMBER,
    externalNumber: c.phone,
    date: now.toISOString(),
    smsDirection: "SENT",
    body: text,
  });
}

test("mobile normalization excludes fixed/invalid numbers; SMS units and STOP parsing", () => {
  assert.equal(mobileNumber("06 76 38 70 37"), "+33676387037");
  assert.equal(mobileNumber("0033676387037"), "+33676387037");
  assert.throws(() => mobileNumber("0479000000"));
  assert.throws(() => mobileNumber("+1 212 000 0000"));
  assert.equal(smsLength("a".repeat(160)).segments, 1);
  assert.equal(smsLength("a".repeat(161)).segments, 2);
  assert.equal(smsLength("€".repeat(81)).segments, 2);
  assert.equal(smsLength("🙂".repeat(36)).segments, 2);
  assert.ok(isOpposition("STOP merci"));
  assert.ok(isOpposition("Supprimez mon numéro"));
  assert.ok(isOpposition("Pas intéressé"));
  assert.equal(isOpposition("Bonjour, quel est votre tarif ?"), false);
  assert.equal(keyMatches("x".repeat(32), hash("y".repeat(32))), false);
});
test("webhook and dispatch require separate secrets; test mode has no recipient", async () => {
  assert.equal((await hook(request("onoff", {}))).status, 401);
  assert.equal(
    (await dispatch(request("dispatch", { mode: "test" }, keys.webhookKey)))
      .status,
    401,
  );
  const response = await dispatch(
    request("dispatch", { mode: "test" }, keys.dispatchKey),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.send, false);
  assert.equal(data.to, "");
  assert.equal((await hook(request("onoff", {}, keys.webhookKey))).status, 400);
  assert.equal(await prisma.smsOutreachContact.count(), 0);
  assert.ok(
    (
      await prisma.smsAutomationSettings.findUniqueOrThrow({
        where: { id: "onoff" },
      })
    ).dispatchVerifiedAt,
  );
  await assert.rejects(() => createConnectionKeys());
});
test("drafts, known websites and incomplete verification cannot be dispatched", async () => {
  const c = await contact(1, false);
  const f = reviewForm(c.messages[0].body);
  f.set("websiteFinding", "HAS_WEBSITE");
  await assert.rejects(() => saveSms(c.id, f, "admin"));
  f.set("websiteFinding", "NOT_FOUND");
  f.delete("verified");
  await assert.rejects(() => saveSms(c.id, f, "admin"));
  await enable();
  assert.equal((await claimSms("test-request-1", now)).send, false);
});
test("duplicate phone encodings do not create separate prospects", async () => {
  const c = await contact();
  const f = new FormData();
  for (const [k, v] of Object.entries({
    companyName: "Duplicate",
    city: "Dolomieu",
    phone: c.phone,
    sourceUrl: "https://example.test/a",
    websiteCheckUrl: "https://example.test/b",
  }))
    f.set(k, v);
  await assert.rejects(() => addContact(f));
  assert.equal(await prisma.smsOutreachContact.count(), 1);
});
test("paused and night/weekend windows never dispatch", async () => {
  await contact();
  assert.equal((await claimSms("paused-request", now)).send, false);
  await enable();
  assert.equal(
    (await claimSms("night-request", new Date("2026-09-09T23:00Z"))).send,
    false,
  );
  assert.equal(
    (await claimSms("weekend-request", new Date("2026-09-12T10:00Z"))).send,
    false,
  );
});
test("concurrent claims dispatch once and no retries return the payload", async () => {
  await contact();
  await contact(2);
  await enable();
  const result = await Promise.all([
    claimSms("concurrent-one", now),
    claimSms("concurrent-two", now),
  ]);
  assert.equal(result.filter((r) => r.send).length, 1);
  assert.equal((await claimSms("concurrent-one", now)).send, false);
  assert.equal((await claimSms("another-request", now)).send, false);
  assert.equal(
    (await claimSms("later-request", new Date(now.getTime() + 16 * 60000)))
      .send,
    false,
  );
  assert.equal(
    await prisma.smsOutreachMessage.count({ where: { status: "REVIEW" } }),
    1,
  );
});
test("only exact Onoff outgoing confirmations unlock the next message; duplicates are idempotent", async () => {
  const c = await contact();
  await contact(2);
  await enable();
  const result = await claimSms("first-request", now);
  assert.ok(result.send && "text" in result);
  await confirmation(c, "Different text");
  assert.equal(
    await prisma.smsOutreachMessage.count({ where: { status: "SENT" } }),
    0,
  );
  const id = randomUUID();
  await confirmation(c, result.text, id);
  await confirmation(c, result.text, id);
  assert.equal(
    await prisma.smsOutreachMessage.count({ where: { status: "SENT" } }),
    1,
  );
  assert.equal(
    await prisma.smsOutreachEvent.count({ where: { kind: "SENT" } }),
    1,
  );
  assert.equal((await claimSms("second-request", now)).send, true);
});
test("daily limit counts attempted sends across five confirmed SMS", async () => {
  for (let i = 1; i <= 6; i++) await contact(i);
  await enable();
  for (let i = 1; i <= 5; i++) {
    const result = await claimSms(`request-${i}`, now);
    assert.ok(result.send && "text" in result);
    await confirmation({ phone: result.to }, result.text);
  }
  const final = await claimSms("request-six", now);
  assert.equal(final.send, false);
  assert.equal(final.reason, "daily_limit");
});
test("inbound replies cancel pending SMS; STOP stays permanent after later replies", async () => {
  const c = await contact();
  const base = {
    eventName: "SMS",
    onoffUserNumber: ONOFF_NUMBER,
    externalNumber: c.phone,
    date: now.toISOString(),
    smsDirection: "RECEIVED",
  };
  await recordOnoff({
    ...base,
    id: "reply-one",
    body: "Bonjour, pouvez-vous préciser ?",
  });
  assert.equal(
    (
      await prisma.smsOutreachMessage.findUniqueOrThrow({
        where: { contactId: c.id },
      })
    ).status,
    "SKIPPED",
  );
  await recordOnoff({ ...base, id: "reply-stop", body: "STOP merci" });
  await recordOnoff({ ...base, id: "reply-later", body: "Merci" });
  await recordOnoff({ ...base, id: "reply-stop", body: "STOP merci" });
  assert.equal(
    (await prisma.smsOutreachContact.findUniqueOrThrow({ where: { id: c.id } }))
      .stopReason,
    "STOP",
  );
  assert.equal(await prisma.smsSuppression.count(), 1);
  assert.equal(
    await prisma.smsOutreachEvent.count({
      where: { externalId: "onoff:reply-stop" },
    }),
    1,
  );
});
test("unrelated conversations and other Onoff numbers are not imported", async () => {
  const c = await contact();
  const base = {
    id: "unrelated",
    eventName: "SMS",
    onoffUserNumber: ONOFF_NUMBER,
    externalNumber: "+33699999999",
    date: now.toISOString(),
    smsDirection: "RECEIVED",
    body: "private text",
  };
  await recordOnoff(base);
  await recordOnoff({
    ...base,
    id: "other-line",
    onoffUserNumber: "+33699999999",
    externalNumber: c.phone,
  });
  assert.equal(
    await prisma.smsOutreachEvent.count({ where: { kind: "REPLIED" } }),
    0,
  );
  assert.equal(await prisma.smsOutreachContact.count(), 1);
});
test("stale approvals and later edits withdraw eligibility", async () => {
  const c = await contact();
  await enable();
  await prisma.smsOutreachContact.update({
    where: { id: c.id },
    data: { checkedAt: new Date("2026-01-01") },
  });
  assert.equal((await claimSms("stale-request", now)).send, false);
  const f = reviewForm(c.messages[0].body);
  f.set("action", "save");
  await saveSms(c.id, f, "admin");
  assert.equal(
    (
      await prisma.smsOutreachMessage.findUniqueOrThrow({
        where: { contactId: c.id },
      })
    ).status,
    "DRAFT",
  );
});
test("manual opposition blocks reapproval and later sending", async () => {
  const c = await contact();
  await stopSms(c.id, "STOP");
  await enable();
  assert.equal((await claimSms("blocked-request", now)).send, false);
  await assert.rejects(() =>
    saveSms(c.id, reviewForm(c.messages[0].body), "admin"),
  );
});
test("SMS approval and opposition exclude email even before the records are linked", async () => {
  const c = await contact(1, false);
  const lead = { id: randomUUID(), phone: "06 00 00 00 01" };
  assert.equal(
    await prisma.$transaction((tx) => smsBlocksEmail(tx, lead)),
    false,
  );
  await saveSms(c.id, reviewForm(c.messages[0].body), "admin");
  assert.equal(
    await prisma.$transaction((tx) => smsBlocksEmail(tx, lead)),
    true,
  );
  await stopSms(c.id, "STOP");
  assert.equal(
    await prisma.$transaction((tx) => smsBlocksEmail(tx, lead)),
    true,
  );
});
test("manual reconciliation requires evidence and never retries the uncertain message", async () => {
  const c = await contact();
  await contact(2);
  await enable();
  assert.equal((await claimSms("uncertain-claim", now)).send, true);
  const f = new FormData();
  f.set("outcome", "failed");
  f.set(
    "evidence",
    "Journal Onoff contrôlé : envoi absent et erreur confirmée.",
  );
  await assert.rejects(() => reconcileSms(c.id, f));
  f.set("verified", "on");
  await reconcileSms(c.id, f);
  assert.equal(
    (
      await prisma.smsOutreachMessage.findUniqueOrThrow({
        where: { contactId: c.id },
      })
    ).status,
    "SKIPPED",
  );
  const next = await claimSms("after-reconciliation", now);
  assert.ok(next.send);
  assert.notEqual(next.to, c.phone);
  assert.equal(
    await prisma.smsOutreachEvent.count({
      where: { contactId: c.id, kind: "MANUAL_RECONCILIATION" },
    }),
    1,
  );
});
