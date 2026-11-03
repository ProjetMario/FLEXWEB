import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuoteMessage, quoteMessagePrefix, quoteNeedMaxLength, declaredSources } from '../../src/lib/declared-source.mjs';
import { publicLanding } from '../../src/lib/acquisition.ts';

const context = { summary: 'Demande de devis : Site vitrine, 299 € TTC en paiement unique.' };

test('declared discovery is optional and only known labels enter the commercial message', () => {
  const need = 'Un site pour présenter mon activité et recevoir des demandes.';
  const original = `${context.summary}\nConditions à confirmer dans une proposition adaptée avant tout paiement.\n\nBesoin du client :\n${need}`;
  assert.equal(buildQuoteMessage(context, need), original);
  for (const declaredSource of ['', 'unknown', 'constructor', 'chatgpt\nprivate@example.invalid']) {
    assert.equal(buildQuoteMessage({ ...context, declaredSource }, need), original);
  }
  for (const source of declaredSources) {
    const message = buildQuoteMessage({ ...context, declaredSource: source.value }, need);
    assert.ok(message.includes(`Découverte déclarée par le client : ${source.label}.`));
    assert.ok(message.endsWith(need));
  }
});

test('the 3000 character intake budget includes quote, preview and declared discovery without truncation', () => {
  const detailed = { summary: 'P'.repeat(650), prospectSlug: 'test-maquette', declaredSource: 'recommendation' };
  const prefix = quoteMessagePrefix(detailed);
  assert.equal(quoteNeedMaxLength(detailed), 3000 - prefix.length);
  assert.ok(quoteNeedMaxLength(detailed) < 2400);
  const need = 'D'.repeat(quoteNeedMaxLength(detailed));
  const result = buildQuoteMessage(detailed, need);
  assert.equal(result.length, 3000);
  assert.ok(result.endsWith(need));
  assert.throws(() => buildQuoteMessage(detailed, need + 'X'), /aucun texte n’a été supprimé/);
  assert.equal(quoteNeedMaxLength(context), 2400);
});

test('new public landing routes are eligible without accepting parameters or private suffixes', () => {
  for (const route of ['/creation-site-internet-pas-cher/', '/francophonie/', '/en/affordable-websites/', '/en/french-speaking-clients/']) {
    assert.equal(publicLanding(route), route);
    assert.equal(publicLanding(`${route}?email=private@example.invalid`), null);
    assert.equal(publicLanding(`${route}client-secret/`), null);
  }
});
