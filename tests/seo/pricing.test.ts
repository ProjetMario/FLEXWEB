import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { offerForIntake, publicQuoteSchema, assertStandardQuote } from "../../apps/saas-platform/lib/automation/core.ts";

// Run after the public-site build. These checks compare published HTML/JSON-LD
// with the intake contract, so a correct catalogue alone is not sufficient.
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
const expected = [
  { id: "essentielle", service: "site", tier: "simple", euros: 299 },
  { id: "visibilite", service: "site", tier: "visibility", euros: 590 },
  { id: "crm-automation", service: "automation", tier: "crm", euros: 990 },
] as const;
const readPage = (path: string) => readFileSync(join(dist, path), "utf8");
const decode = (text: string) => text
  .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
  .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
const visibleText = (html: string) => decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " "))
  .normalize("NFKC").replace(/\s+/g, " ");
function schemas(html: string): Record<string, any>[] {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      const parsed = JSON.parse(match[1]);
      return parsed["@graph"] || [parsed];
    });
}

test("home and pricing expose exactly three priced offers with correct intake selections", () => {
  for (const path of ["index.html", "pricing/index.html"]) {
    const html = readPage(path);
    const cards = [...html.matchAll(/<article\b[^>]*id="offre-([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
    assert.deepEqual(cards.map((card) => card[1]), expected.map((offer) => offer.id), path);
    for (const offer of expected) {
      const card = cards.find((entry) => entry[1] === offer.id)![2];
      assert.match(visibleText(card), new RegExp(`${offer.euros}\\s*€\\s*TTC`), `${path}: ${offer.id}`);
      assert.match(visibleText(card), /Paiement unique/);
      const href = decode(card.match(/<a\b[^>]*href="([^"]+)"/)![1]);
      const url = new URL(href, "https://flex-web.fr");
      assert.equal(url.pathname, "/demarrer/");
      assert.equal(url.searchParams.get("service"), offer.service);
      assert.equal(url.searchParams.get("offre"), offer.id);
      assert.match(visibleText(card), /Devis gratuit avant tout paiement/);
    }
    assert.match(visibleText(cards[0][2]), /jusqu’à 5 pages/i);
    assert.match(visibleText(cards[1][2]), /5 pages et plus, selon le périmètre validé au devis/);
    for (const term of ["Google", "Bing", "SEO", "GEO"]) assert.ok(visibleText(cards[1][2]).includes(term));
    for (const term of ["CRM", "contacts", "devis", "factures", "tâches répétitives"]) assert.ok(visibleText(cards[2][2]).includes(term));
    const text = visibleText(html);
    assert.match(text, /49\s*€\s*TTC \/ mois/);
    assert.match(text, /99\s*€\s*TTC \/ mois/);
  }
});

test("pricing JSON-LD separates three one-time TTC prices from two monthly options", () => {
  const html = readPage("pricing/index.html");
  const catalogues = schemas(html).filter((item) => item["@type"] === "OfferCatalog");
  assert.equal(catalogues.length, 1);
  const offers = catalogues[0].itemListElement;
  assert.deepEqual(offers.map((offer: any) => Number(offer.price)), [299, 590, 990, 49, 99]);
  for (const [index, offer] of offers.entries()) {
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.priceCurrency, "EUR");
    assert.equal(offer.priceSpecification.valueAddedTaxIncluded, true);
    assert.equal(offer.priceSpecification.price, offer.price);
    if (index < 3) {
      assert.equal(new URL(offer.url).searchParams.get("offre"), expected[index].id);
      assert.equal(offer.priceSpecification.unitText, undefined);
    } else {
      assert.equal(offer.priceSpecification.unitText, "mois");
      assert.equal(new URL(offer.url).hash, "#options");
    }
  }
  const faq = schemas(html).find((item) => item["@type"] === "FAQPage");
  assert.ok(faq.mainEntity.some((item: any) => /aucune position ni présence/.test(item.acceptedAnswer.text)));
});

test("local website schemas offer only 299/590 sites and visible copy names the 990 CRM", () => {
  const locations = readdirSync(dist).filter((name) => name.startsWith("creation-site-internet-"));
  assert.ok(locations.length >= 200, "build must include local public landing pages");
  for (const name of locations) {
    const html = readPage(`${name}/index.html`);
    const service = schemas(html).find((item) => item["@type"] === "Service");
    assert.ok(service, `${name}: missing service schema`);
    assert.deepEqual(service.offers.map((offer: any) => Number(offer.price)), [299, 590], name);
    for (const offer of service.offers) assert.equal(offer.priceSpecification.valueAddedTaxIncluded, true);
    const text = visibleText(html);
    assert.match(text, /Installation d’un CRM.*?990\s*€\s*TTC/, name);
    assert.doesNotMatch(text, /site (?:vitrine )?complet (?:à |coûte )?990\s*€/i, name);
  }
});

test("public offer links resolve to server-owned prices while extra pages remain scoped and legacy terms stay intact", () => {
  const catalogue = schemas(readPage("pricing/index.html")).find((item) => item["@type"] === "OfferCatalog");
  for (const offer of expected) {
    const rendered = catalogue.itemListElement.find((item: any) => new URL(item.url).searchParams.get("offre") === offer.id);
    assert.ok(rendered);
    const request = publicQuoteSchema.parse({ version: "2026-09-24-ttc", service: offer.service, tier: offer.tier, options: [] });
    const snapshot = offerForIntake({ planId: offer.id, publicQuote: request });
    assert.equal(snapshot.setupCents, Number(rendered.price) * 100);
    assert.equal(snapshot.monthlyCents, 0);
    assert.equal(snapshot.taxBasis, "TTC");
    if (offer.service === "automation") {
      assert.equal(snapshot.quoteOnly, true);
      assert.equal(snapshot.pages, 0);
      assert.throws(() => assertStandardQuote(snapshot));
    } else {
      assertStandardQuote(snapshot);
      assert.equal(snapshot.pages, 5);
      if (offer.tier === "visibility") assert.ok(snapshot.features.some((feature) => /5 pages et plus, selon le périmètre validé au devis/.test(feature)));
    }
  }
  const historic = offerForIntake({ planId: "achat", publicQuote: publicQuoteSchema.parse({ version: "2026-09-11-ttc", service: "site", tier: "complete", options: [] }) });
  assert.equal(historic.name, "Site vitrine complet");
  assert.equal(historic.setupCents, 99000);
  assert.equal(historic.quoteOnly, false);
});
