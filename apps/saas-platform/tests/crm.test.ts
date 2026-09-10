import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  importProspects,
  prepareCrmChannel,
  recordCrmEvent,
  crmLock,
  crmBlocksChannel,
} from "../lib/prospection/crm-service";
import {
  parseCsv,
  normalizePhone,
  renderCrmTemplate,
} from "../lib/prospection/crm-core";
import { processIncoming } from "../lib/outreach/mail";
import { saveLead } from "../lib/outreach/service";
import { recordOnoff, createConnectionKeys } from "../lib/sms/service";
import { defaultSms, ONOFF_NUMBER, hash } from "../lib/sms/core";
import { emailHash } from "../lib/outreach/core";
if (
  process.env.AUTOMATION_TEST_DATABASE !== "true" ||
  new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1"
)
  throw Error("Use isolated harness");
after(() => prisma.$disconnect());
beforeEach(async () => {
  await prisma.smsAutomationSettings.deleteMany();
  await prisma.smsOutreachEvent.deleteMany();
  await prisma.smsOutreachMessage.deleteMany();
  await prisma.smsOutreachContact.deleteMany();
  await prisma.outreachEvent.deleteMany();
  await prisma.outreachMessage.deleteMany();
  await prisma.outreachLead.deleteMany();
  await prisma.prospect.deleteMany();
  await prisma.smsSuppression.deleteMany();
  await prisma.outreachSuppression.deleteMany();
});
const row = (n = 1) => ({
  entreprise: `Atelier CRM ${n}`,
  activite: "Menuiserie",
  departement: "38",
  commune: "Dolomieu",
  telephone: `06 11 22 ${String(n).padStart(4, "0")}`,
  email: `atelier${n}@example.test`,
  siren: String(800000000 + n),
  siret: String(800000000 + n) + "00012",
  source: "Test isolé",
  url_source: `https://example.test/entreprise/${n}`,
  date_collecte: new Date().toISOString().slice(0, 10),
});
async function imported() {
  await importProspects([row()], randomUUID());
  return prisma.prospect.findFirstOrThrow();
}
test("CSV handles BOM, quoted semicolons, multiline notes and rejects malformed data", () => {
  const r = parseCsv(
    '\uFEFF"entreprise";"url_source";"notes"\r\n"Atelier; Lyon";"https://example.test";"Ligne 1\nLigne ""2"""',
  );
  assert.equal(r[0].entreprise, "Atelier; Lyon");
  assert.equal(r[0].notes, 'Ligne 1\nLigne "2"');
  assert.throws(() => parseCsv('entreprise;url_source\n"unclosed'));
  assert.throws(() => parseCsv("entreprise;url_source\na;b;c"));
  assert.equal(normalizePhone("06 11 22 00 01"), "+33611220001");
  assert.throws(() => normalizePhone("0611"));
  assert.equal(
    renderCrmTemplate("Pour {{entreprise}} à {{ville}}", {
      companyName: "Atelier",
      city: "Lyon",
    }),
    "Pour Atelier à Lyon",
  );
});
test("concurrent and repeated imports are idempotent and never approve or queue messages", async () => {
  const batch = randomUUID();
  const outcomes = await Promise.all([
    importProspects([row(), row(2)], batch),
    importProspects([row(), row(2)], batch),
  ]);
  assert.equal(
    outcomes.reduce((n, r) => n + r.created, 0),
    2,
  );
  assert.equal(await prisma.prospect.count(), 2);
  assert.equal(await prisma.outreachMessage.count(), 0);
  assert.equal(await prisma.smsOutreachMessage.count(), 0);
  assert.equal(
    await prisma.prospect.count({
      where: {
        status: "NOUVEAU",
        websiteFinding: "TO_CHECK",
        preferredChannel: "NONE",
      },
    }),
    2,
  );
});
test("import preserves oppositions and reports conflicting company identities", async () => {
  const p = await imported();
  await prisma.prospect.update({
    where: { id: p.id },
    data: { doNotContactAt: new Date(), internalNotes: "Conserver cette note" },
  });
  assert.equal((await importProspects([row()], randomUUID())).duplicates, 1);
  const conflict = { ...row(2), telephone: row().telephone };
  assert.equal(
    (await importProspects([conflict], randomUUID())).conflicts.length,
    1,
  );
  const current = await prisma.prospect.findUniqueOrThrow({
    where: { id: p.id },
  });
  assert.ok(current.doNotContactAt);
  assert.equal(current.internalNotes, "Conserver cette note");
});
test("import without phone or SIREN remains a candidate and supports email drafts", async () => {
  await importProspects(
    [{ ...row(), telephone: "", siren: "", siret: "" }],
    randomUUID(),
  );
  const p = await prisma.prospect.findFirstOrThrow();
  await assert.rejects(prepareCrmChannel(p.id, "SMS"));
  await prepareCrmChannel(p.id, "EMAIL");
  assert.equal(
    await prisma.outreachMessage.count({ where: { status: "DRAFT" } }),
    3,
  );
  assert.equal(
    (await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } })).siren,
    null,
  );
});
test("preparing both channels links one CRM identity and all messages remain draft", async () => {
  const p = await imported();
  await prepareCrmChannel(p.id, "EMAIL");
  await prepareCrmChannel(p.id, "SMS");
  await prepareCrmChannel(p.id, "EMAIL");
  await prepareCrmChannel(p.id, "SMS");
  const c = await prisma.smsOutreachContact.findFirstOrThrow();
  const l = await prisma.outreachLead.findFirstOrThrow();
  assert.equal(c.prospectId, p.id);
  assert.equal(l.prospectId, p.id);
  assert.equal(c.leadId, l.id);
  assert.equal(
    await prisma.smsOutreachMessage.count({ where: { status: "DRAFT" } }),
    1,
  );
  assert.equal(
    await prisma.outreachMessage.count({ where: { status: "DRAFT" } }),
    3,
  );
  assert.equal(
    (
      await prisma.outreachCampaign.findUniqueOrThrow({
        where: { id: l.campaignId },
      })
    ).enabled,
    false,
  );
});
test("an imported email cannot be approved before individual qualification", async () => {
  const p = await imported();
  await prepareCrmChannel(p.id, "EMAIL");
  const l = await prisma.outreachLead.findFirstOrThrow({
    include: { messages: true },
  });
  const f = new FormData();
  for (const [k, v] of Object.entries({
    email: l.email!,
    website: "",
    source: l.registryUrl,
    action: "approve",
    relevance: "on",
    diagnostic: "on",
  }))
    f.set(k, v);
  for (const m of l.messages) {
    f.set("subject" + m.step, m.subject);
    f.set("text" + m.step, m.text);
  }
  await assert.rejects(saveLead(l.id, f, "test-admin"), /Qualifiez/);
  await prisma.prospect.update({
    where: { id: p.id },
    data: { websiteFinding: "NOT_FOUND", websiteCheckedAt: new Date() },
  });
  await saveLead(l.id, f, "test-admin");
  assert.equal(
    (await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } }))
      .preferredChannel,
    "EMAIL",
  );
  await assert.rejects(prepareCrmChannel(p.id, "SMS"), /autre canal/);
});
test("incoming email content joins timeline, cancels both queues and creates one reminder", async () => {
  const p = await imported();
  await prepareCrmChannel(p.id, "EMAIL");
  await prepareCrmChannel(p.id, "SMS");
  const l = await prisma.outreachLead.findFirstOrThrow();
  await prisma.outreachMessage.updateMany({
    where: { leadId: l.id, step: 0 },
    data: { status: "SENT", attemptedAt: new Date(), sentAt: new Date() },
  });
  await processIncoming(
    {
      uid: 3,
      from: [p.email!],
      references: [],
      bounce: false,
      subject: "Votre proposition",
      text: "Bonjour, pouvez-vous me rappeler ?",
    },
    "test",
  );
  await processIncoming(
    { uid: 3, from: [p.email!], references: [], bounce: false, text: "same" },
    "test",
  );
  assert.equal(
    await prisma.prospectInteraction.count({
      where: { type: "REPONSE_RECUE" },
    }),
    1,
  );
  assert.equal(
    await prisma.followUp.count({
      where: { prospectId: p.id, status: "PENDING" },
    }),
    1,
  );
  assert.equal(
    (await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } })).status,
    "REPONDU",
  );
  assert.equal(
    await prisma.smsOutreachMessage.count({ where: { status: "SKIPPED" } }),
    1,
  );
  assert.match(
    (await prisma.prospectInteraction.findFirstOrThrow()).note!,
    /pouvez-vous me rappeler/,
  );
});
test("SMS STOP suppresses both destinations and duplicate callbacks are harmless", async () => {
  const p = await imported();
  await prepareCrmChannel(p.id, "EMAIL");
  await prepareCrmChannel(p.id, "SMS");
  await createConnectionKeys();
  const payload = {
    id: "crm-stop",
    eventName: "SMS",
    onoffUserNumber: ONOFF_NUMBER,
    externalNumber: p.phone,
    date: new Date(Date.now() + 10).toISOString(),
    smsDirection: "RECEIVED",
    body: "STOP",
  };
  await recordOnoff(payload);
  await recordOnoff(payload);
  assert.ok(
    (await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } }))
      .doNotContactAt,
  );
  assert.ok(
    await prisma.smsSuppression.findUnique({
      where: { phoneHash: hash(p.phone) },
    }),
  );
  assert.ok(
    await prisma.outreachSuppression.findUnique({
      where: { emailHash: emailHash(p.email!) },
    }),
  );
  assert.equal(
    await prisma.prospectInteraction.count({
      where: { type: "REPONSE_RECUE" },
    }),
    1,
  );
  assert.equal(
    await prisma.outreachMessage.count({ where: { status: "SKIPPED" } }),
    3,
  );
  await assert.rejects(prepareCrmChannel(p.id, "EMAIL"), /non-contact/);
});
test("a later sent callback never resurrects an opposition or sales outcome", async () => {
  const p = await imported();
  await prisma.$transaction(async (tx) => {
    await crmLock(tx);
    await recordCrmEvent(tx, {
      prospectId: p.id,
      key: "stop",
      channel: "SMS",
      kind: "STOP",
      body: "STOP",
    });
    await recordCrmEvent(tx, {
      prospectId: p.id,
      key: "late-send",
      channel: "EMAIL",
      kind: "SENT",
      body: "late",
    });
  });
  assert.equal(
    (await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } })).status,
    "PAS_INTERESSE",
  );
  assert.equal(
    await prisma.$transaction((tx) => crmBlocksChannel(tx, p.id, "SMS")),
    true,
  );
});
test("custom template is rendered into draft only and invalid SMS cannot be prepared", async () => {
  const p = await imported();
  const template = await prisma.crmMessageTemplate.create({
    data: { name: "Test", channel: "SMS", body: defaultSms("{{entreprise}}") },
  });
  await prepareCrmChannel(p.id, "SMS", template.id);
  const m = await prisma.smsOutreachMessage.findFirstOrThrow();
  assert.ok(m.body.includes(p.companyName));
  assert.equal(m.status, "DRAFT");
  const other = await prisma.crmMessageTemplate.create({
    data: {
      name: "Wrong",
      channel: "EMAIL",
      body: "Bonjour, un message de test non destiné aux SMS.",
    },
  });
  await assert.rejects(prepareCrmChannel(p.id, "SMS", other.id), /canal/);
});

test("public Netlify origin passes behind proxy but foreign origins fail", async () => {
  const { crmOriginAllowed } = await import("../lib/prospection/crm-origin");
  assert.equal(crmOriginAllowed(new Request("http://localhost:3000/api/crm/import", { headers: { origin: "https://flexweb-gestion.netlify.app" } })), true);
  assert.equal(crmOriginAllowed(new Request("http://localhost:3000/api/crm/import", { headers: { origin: "https://untrusted.example" } })), false);
});
test("legacy linkage reuses imported identity and preserves opposition without sending", async () => {
  const { linkLegacyCrm } = await import("../lib/prospection/crm-service");
  const p = await imported();
  await prepareCrmChannel(p.id, "EMAIL");
  await prisma.outreachLead.updateMany({ data: { prospectId: null, stoppedAt: new Date(), stopReason: "REFUSED" } });
  const result = await linkLegacyCrm();
  assert.equal(result.linked, 1);
  assert.equal(result.remaining, 0);
  assert.equal(await prisma.prospect.count(), 1);
  assert.ok((await prisma.prospect.findUniqueOrThrow({ where: { id: p.id } })).doNotContactAt);
  assert.equal(await prisma.outreachMessage.count({ where: { status: "APPROVED" } }), 0);
  assert.equal((await linkLegacyCrm()).linked, 0);
});
