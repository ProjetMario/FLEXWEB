import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  optOutToken,
  readOptOutToken,
  emailHash,
  parisTime,
  dueStep,
  newMessageId,
} from "../lib/outreach/core";
import {
  publicAddress,
  webUrl,
  inspectHtml,
  publicGet,
} from "../lib/outreach/web-audit";
import { eligibleCompany, prepareDrafts } from "../lib/outreach/discovery";
import { saveLead, stopLead, classifyLead } from "../lib/outreach/service";
import { processIncoming } from "../lib/outreach/mail";
import { sendNext, withOutreachLease } from "../lib/outreach/jobs";
import {
  GET as optoutPage,
  POST as optout,
} from "../app/api/outreach/unsubscribe/route";
import { POST as runApi } from "../app/api/outreach/run/route";
if (
  process.env.AUTOMATION_TEST_DATABASE !== "true" ||
  new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1"
)
  throw Error("Use the isolated harness");
after(async () => {
  await prisma.$disconnect();
});
const now = new Date("2026-09-09T08:00:00Z");
async function lead() {
  const campaign = await prisma.outreachCampaign.create({
    data: { key: "test-" + randomUUID(), name: "Test isolé", enabled: true },
  });
  const l = await prisma.outreachLead.create({
    data: {
      campaignId: campaign.id,
      siren: "123456789",
      siret: "12345678900001",
      companyName: "Atelier " + randomUUID().slice(0, 8),
      city: "Chambéry",
      postalCode: "73000",
      activityCode: "43.22A",
      registryUrl:
        "https://annuaire-entreprises.data.gouv.fr/entreprise/123456789",
      email: `${randomUUID()}@example.test`,
      contactSourceUrl: "https://example.test/contact",
      sourceFetchedAt: new Date(),
      auditState: "MANUAL",
    },
  });
  await prepareDrafts(l.id, null);
  return l;
}
async function form(id: string, action = "approve") {
  const l = await prisma.outreachLead.findUniqueOrThrow({
    where: { id },
    include: { messages: true },
  });
  const f = new FormData();
  f.set("action", action);
  f.set("email", l.email!);
  f.set("website", l.website || "");
  f.set("source", l.contactSourceUrl!);
  f.set("relevance", "on");
  f.set("diagnostic", "on");
  for (const m of l.messages) {
    f.set("subject" + m.step, m.subject);
    f.set("text" + m.step, m.text);
  }
  return f;
}
async function ready(id: string) {
  await saveLead(id, await form(id), "test-admin");
  await prisma.outreachLead.update({
    where: { id },
    data: { approvedAt: now },
  });
  await prisma.outreachMailbox.upsert({
    where: { id: "ionos" },
    create: { id: "ionos", verifiedAt: now, syncedAt: now },
    update: {
      verifiedAt: now,
      syncedAt: now,
      lastError: null,
      needsReview: false,
    },
  });
}
async function isolatedSend(
  id: string,
  send: Parameters<typeof sendNext>[1],
  at = now,
) {
  const l = await prisma.outreachLead.findUniqueOrThrow({ where: { id } });
  await prisma.outreachCampaign.updateMany({
    where: { id: { not: l.campaignId } },
    data: { enabled: false },
  });
  process.env.OUTREACH_SEND_ENABLED = "true";
  process.env.IONOS_MAIL_PASSWORD = "test-only-never-connect";
  try {
    return await sendNext(at, send);
  } finally {
    process.env.OUTREACH_SEND_ENABLED = "false";
    process.env.IONOS_MAIL_PASSWORD = "";
  }
}
test("public-site requests reject private networks, literals, credentials and unsafe ports", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "0.0.0.0",
    "100.64.0.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
  for (const url of [
    "http://127.0.0.1",
    "http://2130706433",
    "http://localhost",
    "http://[::1]",
    "https://user:secret@example.com",
    "http://example.com:22",
    "file:///etc/passwd",
  ])
    assert.throws(() => webUrl(url));
  await assert.rejects(publicGet("http://127.0.0.1/secret"));
});
test("targeting excludes non-public, inactive, non-local and large companies", () => {
  const c = {
    siren: "123456789",
    nom_complet: "Entreprise",
    activite_principale: "43.22A",
    statut_diffusion: "O",
    etat_administratif: "A",
    nombre_etablissements: 1,
    siege: {
      siret: "12345678900001",
      code_postal: "73000",
      libelle_commune: "Chambéry",
      etat_administratif: "A",
      statut_diffusion_etablissement: "O",
    },
  };
  assert.equal(eligibleCompany(c), true);
  assert.equal(eligibleCompany({ ...c, statut_diffusion: "P" }), false);
  assert.equal(eligibleCompany({ ...c, nombre_etablissements: 25 }), false);
  assert.equal(
    eligibleCompany({ ...c, siege: { ...c.siege, code_postal: "75001" } }),
    false,
  );
  const findings = inspectHtml(
    '<html><meta name="viewport"><a href="tel:0123456789">Appeler</a><form></form></html>',
    "https://example.test",
  );
  assert.equal(findings.length, 0);
  assert.ok(
    inspectHtml("<html>Bonjour</html>", "https://example.test").every((f) =>
      f.label.includes("page examinée"),
    ),
  );
});
test("opt-out signatures reject modifications and HTML suffixes; GET never changes state", async () => {
  const l = await lead();
  const token = optOutToken(l.id);
  assert.equal(readOptOutToken(token), l.id);
  assert.equal(readOptOutToken(token + '.\"><script>'), null);
  assert.equal(
    readOptOutToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0")),
    null,
  );
  const res = await optoutPage(
    new Request("https://example.test/api/outreach/unsubscribe?token=" + token),
  );
  assert.equal(res.status, 200);
  assert.equal(
    (await prisma.outreachLead.findUniqueOrThrow({ where: { id: l.id } }))
      .stoppedAt,
    null,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await optout(
          new Request("https://example.test/api/outreach/unsubscribe", {
            method: "POST",
            body: new URLSearchParams({ token }),
          }),
        )
      ).status,
      200,
    );
  assert.ok(
    await prisma.outreachSuppression.findUnique({
      where: { emailHash: emailHash(l.email!) },
    }),
  );
  assert.equal(
    await prisma.outreachMessage.count({
      where: { leadId: l.id, status: "SKIPPED" },
    }),
    3,
  );
  assert.equal(
    (
      await runApi(
        new Request("https://example.test/api/outreach/run", {
          method: "POST",
        }),
      )
    ).status,
    401,
  );
});
test("approval requires reviewed content; edits remove approval and attempts freeze content", async () => {
  const l = await lead();
  const f = await form(l.id);
  f.delete("diagnostic");
  await assert.rejects(saveLead(l.id, f, "admin"));
  await ready(l.id);
  assert.equal(
    (await prisma.outreachLead.findUniqueOrThrow({ where: { id: l.id } }))
      .stage,
    "APPROVED",
  );
  await saveLead(l.id, await form(l.id, "save"), "admin");
  assert.equal(
    (await prisma.outreachLead.findUniqueOrThrow({ where: { id: l.id } }))
      .approvedAt,
    null,
  );
  await ready(l.id);
  await prisma.outreachMessage.update({
    where: { leadId_step: { leadId: l.id, step: 0 } },
    data: { attemptedAt: now, status: "REVIEW" },
  });
  await assert.rejects(saveLead(l.id, await form(l.id), "admin"));
});
test("any matching reply stops the sequence, is idempotent, and never stores unrelated mail", async () => {
  const l = await lead();
  await ready(l.id);
  const m = await prisma.outreachMessage.update({
    where: { leadId_step: { leadId: l.id, step: 0 } },
    data: { attemptedAt: now, status: "SENT", sentAt: now },
  });
  assert.equal(
    await processIncoming(
      {
        uid: 22,
        from: ["unrelated@example.test"],
        references: [],
        bounce: false,
      },
      "test-validity",
    ),
    0,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      await processIncoming(
        { uid: 23, from: [], references: [m.messageId], bounce: false },
        "test-validity",
      ),
      1,
    );
  assert.equal(
    (await prisma.outreachLead.findUniqueOrThrow({ where: { id: l.id } }))
      .stage,
    "REPLIED",
  );
  assert.equal(
    await prisma.outreachEvent.count({
      where: { leadId: l.id, type: "REPLIED" },
    }),
    1,
  );
  await stopLead(l.id, "REFUSED");
  await processIncoming(
    { uid: 24, from: [l.email!], references: [], bounce: false },
    "test-validity",
  );
  assert.equal(
    (await prisma.outreachLead.findUniqueOrThrow({ where: { id: l.id } }))
      .stage,
    "REFUSED",
  );
});
test("sending is gated by mailbox freshness and flags; ambiguous SMTP is not retried", async () => {
  const l = await lead();
  await ready(l.id);
  let calls = 0;
  const send = async () => {
    calls++;
    throw Error("simulated timeout after acceptance");
  };
  await sendNext(now, send);
  assert.equal(calls, 0);
  await prisma.outreachMailbox.update({
    where: { id: "ionos" },
    data: { syncedAt: new Date(now.getTime() - 120000) },
  });
  await isolatedSend(l.id, send);
  assert.equal(calls, 0);
  await prisma.outreachMailbox.update({
    where: { id: "ionos" },
    data: { syncedAt: now },
  });
  await isolatedSend(l.id, send);
  await isolatedSend(l.id, send);
  assert.equal(calls, 1);
  assert.equal(
    (
      await prisma.outreachMessage.findUniqueOrThrow({
        where: { leadId_step: { leadId: l.id, step: 0 } },
      })
    ).status,
    "REVIEW",
  );
});
test("follow-ups wait for day 4/day 10 and previous acceptance; opposition wins globally", async () => {
  const l = await lead();
  await ready(l.id);
  let calls = 0;
  const send = async (input: { text: string }) => {
    calls++;
    assert.ok(input.text.includes("/api/outreach/unsubscribe?token="));
    return true;
  };
  await isolatedSend(l.id, send);
  await isolatedSend(l.id, send);
  assert.equal(calls, 1);
  const day5 = new Date("2026-09-14T08:00:00Z");
  await prisma.outreachMailbox.update({
    where: { id: "ionos" },
    data: { syncedAt: day5 },
  });
  await isolatedSend(l.id, send, day5);
  assert.equal(calls, 2);
  await stopLead(l.id, "UNSUBSCRIBED");
  await isolatedSend(l.id, send, day5);
  assert.equal(calls, 2);
  const other = await lead();
  await prisma.outreachLead.update({
    where: { id: other.id },
    data: { email: l.email },
  });
  await assert.rejects(saveLead(other.id, await form(other.id), "admin"));
  assert.equal(
    dueStep(1, now, now, new Date(now.getTime() + 3 * 86400000)),
    false,
  );
  assert.equal(
    dueStep(2, now, now, new Date(now.getTime() + 10 * 86400000)),
    true,
  );
  assert.equal(parisTime(new Date("2026-09-12T09:00:00Z")).allowed, false);
  assert.equal(parisTime(new Date("2026-09-09T16:00:00Z")).allowed, false);
});
test("daily cap counts uncertain attempts and the global lease excludes overlapping workers", async () => {
  const l = await lead();
  await ready(l.id);
  for (let i = 0; i < 10; i++) {
    const x = await lead();
    await prisma.outreachMessage.update({
      where: { leadId_step: { leadId: x.id, step: 0 } },
      data: { attemptedAt: now, status: "REVIEW" },
    });
  }
  let calls = 0;
  await isolatedSend(l.id, async () => {
    calls++;
    return true;
  });
  assert.equal(calls, 0);
  let unlock!: () => void;
  const pending = withOutreachLease(async () => {
    await new Promise<void>((resolve) => {
      unlock = resolve;
    });
    return "first";
  });
  while (!unlock) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(await withOutreachLease(async () => "second"), null);
  unlock();
  assert.equal(await pending, "first");
});
test("interested contacts and appointments are handed to the CRM exactly once", async () => {
  const l = await lead();
  const admin = await prisma.membership.findFirstOrThrow({
    where: { role: "SUPER_ADMIN" },
  });
  await classifyLead(l.id, "INTERESTED", "", admin.userId);
  await classifyLead(l.id, "INTERESTED", "", admin.userId);
  const p = await prisma.outreachLead.findUniqueOrThrow({
    where: { id: l.id },
  });
  assert.ok(p.prospectId);
  assert.equal(
    await prisma.followUp.count({ where: { prospectId: p.prospectId } }),
    1,
  );
  const future = new Date(Date.now() + 86400000).toISOString();
  await classifyLead(l.id, "MEETING", future, admin.userId);
  await classifyLead(l.id, "MEETING", future, admin.userId);
  assert.equal(
    await prisma.appointment.count({ where: { prospectId: p.prospectId } }),
    1,
  );
});
