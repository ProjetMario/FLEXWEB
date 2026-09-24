import { test } from "node:test";
import assert from "node:assert/strict";
import { publicQuoteSchema, offerForIntake, assertStandardQuote, intakeSchema, type PublicQuote } from "../lib/automation/core";
import { TTC_QUOTE_VERSION, isInclusiveQuote, isPublicQuote, quoteTaxLabel } from "../lib/automation/public-quote-pricing";

const combinations = [[], ["maintenance"], ["crm"], ["maintenance", "crm"]] as const;
const quoted = (selection: unknown) => {
  const offer = offerForIntake({ planId: "essentielle", publicQuote: publicQuoteSchema.parse(selection) });
  assert("quoteOnly" in offer);
  return offer;
};

test("current 299/590 website offers derive server prices for every optional combination", () => {
  for (const tier of ["simple", "visibility"] as const) {
    for (const options of combinations) {
      const offer = quoted({ version: TTC_QUOTE_VERSION, service: "site", tier, options });
      assert.equal(offer.id, tier === "simple" ? "essentielle" : "visibilite");
      assert.equal(offer.setupCents, tier === "simple" ? 29900 : 59000);
      assert.equal(offer.monthlyCents, options.reduce((sum, option) => sum + (option === "maintenance" ? 4900 : 9900), 0));
      assert.equal(isInclusiveQuote(offer), true);
      assert.equal(offer.pages, 5);
      assert.equal(offer.quoteOnly, false);
      assertStandardQuote(offer);
    }
  }
});

test("990 CRM installation stays a custom-work project, never a website generator checkout", () => {
  for (const options of combinations) {
    const offer = quoted({ version: TTC_QUOTE_VERSION, service: "automation", tier: "crm", options });
    assert.equal(offer.id, "crm-automation");
    assert.equal(offer.setupCents, 99000);
    assert.equal(offer.monthlyCents, options.reduce((sum, option) => sum + (option === "maintenance" ? 4900 : 9900), 0));
    assert.equal(offer.pages, 0);
    assert.equal(offer.quoteOnly, true);
    assert.equal(isInclusiveQuote(offer), true);
    assert.throws(() => assertStandardQuote(offer), /devis sur mesure/);
  }
});

test("historical HT and TTC complete-site offers keep their prices, names and tax bases", () => {
  for (const version of ["2026-09-11", "2026-09-11-ttc"]) {
    for (const options of combinations) {
      const offer = quoted({ version, service: "site", tier: "complete", options });
      assert.equal(offer.id, "achat");
      assert.equal(offer.name, "Site vitrine complet");
      assert.equal(offer.setupCents, 99000);
      assert.equal(offer.quoteOnly, false);
      assert.equal(isPublicQuote(offer), true);
      assert.equal(quoteTaxLabel(offer), version.endsWith("ttc") ? "TTC" : "HT");
    }
  }
  const oldTtc = { publicQuote: { version: "2026-09-11-ttc" }, taxBasis: "HT" };
  assert.equal(isInclusiveQuote(oldTtc), false);
});

test("quote versions cannot be mixed and the caller cannot set price or tax", () => {
  const invalid = [
    { version: TTC_QUOTE_VERSION, service: "site", tier: "complete", options: [] },
    { version: "2026-09-11-ttc", service: "site", tier: "visibility", options: [] },
    { version: "2026-09-11", service: "automation", tier: "crm", options: [] },
    { version: TTC_QUOTE_VERSION, service: "automation", options: ["crm"] },
    { version: TTC_QUOTE_VERSION, service: "automation", tier: "crm", options: ["crm", "crm"] },
    { version: TTC_QUOTE_VERSION, service: "site", tier: "visibility", options: [], setupCents: 1 },
    { version: TTC_QUOTE_VERSION, service: "site", tier: "simple", options: [], taxBasis: "HT" },
  ];
  for (const selection of invalid) assert.equal(publicQuoteSchema.safeParse(selection).success, false);
  assert.throws(() => offerForIntake({ planId: "visibilite", publicQuote: invalid[1] as PublicQuote }));
});

test("application and bespoke automation requests remain unpriced manual quotations", () => {
  for (const version of ["2026-09-11", "2026-09-11-ttc", TTC_QUOTE_VERSION]) {
    for (const service of ["automation", "application"]) {
      const offer = quoted({ version, service });
      assert.equal(offer.setupCents, 0);
      assert.equal(offer.quoteOnly, true);
      assert.throws(() => assertStandardQuote(offer), /devis sur mesure/);
    }
  }
});

test("new plan IDs require a versioned selection in the intake contract", () => {
  const request = {
    requestKey: "d5ef5c77-c8d7-469f-9fc7-072b2e8c6070", accessToken: "a".repeat(64),
    companyName: "Entreprise test", contactName: "Camille Test", email: "test@example.test", phone: "0612345678",
    city: "Chambéry", businessType: "Artisan", message: "Je souhaite créer un site pour mon entreprise.",
    timeline: "rapidement", privacyConsent: true, professional: true,
  };
  for (const planId of ["visibilite", "crm-automation"]) {
    assert.equal(intakeSchema.safeParse({ ...request, planId }).success, false);
  }
  assert.equal(intakeSchema.safeParse({ ...request, planId: "visibilite", publicQuote: { version: TTC_QUOTE_VERSION, service: "site", tier: "visibility", options: [] } }).success, true);
  assert.equal(intakeSchema.safeParse({ ...request, planId: "crm-automation", publicQuote: { version: TTC_QUOTE_VERSION, service: "automation", tier: "crm", options: [] } }).success, true);
});
