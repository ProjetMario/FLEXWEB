import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isProspectMockup} from './document-policy.mjs';

test('only an explicit head marker excludes a prospect from CMS export', () => {
  assert.equal(isProspectMockup('<head><meta name="flexweb-content-kind" content="prospect-mockup"><meta name="robots" content="noindex, nofollow"></head>'), true);
  assert.equal(isProspectMockup("<head><META CONTENT='prospect-mockup' NAME='flexweb-content-kind'></head>"), true);
  assert.equal(isProspectMockup('<head><meta name="robots" content="noindex"></head>'), false);
  assert.equal(isProspectMockup('<head><!-- <meta name="flexweb-content-kind" content="prospect-mockup"> --></head>'), false);
  assert.equal(isProspectMockup(`<head><script>const example = '<meta name="flexweb-content-kind" content="prospect-mockup">';</script></head>`), false);
  assert.equal(isProspectMockup('<head></head><body><p>flexweb-content-kind prospect-mockup</p></body>'), false);
});
