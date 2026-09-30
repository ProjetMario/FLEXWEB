import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialReview } from '../src/lib/editorial-review.mjs';
import { hash } from '../src/lib/contracts.mjs';
test('explicit editorial review signs exactly the displayed text and SEO version', async () => {
  const content = [{ _key: 'stable', _type: 'block', children: [{ _type: 'span', _key: 'span', text: 'Texte relu', marks: [] }] }];
  const fields = { content, seo_title: 'SEO', seo_description: 'Description', data: { additionalSections: [], editorialReview: { hash: 'old' } } };
  const review = await editorialReview(fields, 'admin-id', '2026-09-30T08:00:00Z');
  assert.equal(review.hash, hash({ content, seoTitle: 'SEO', seoDescription: 'Description', additionalSections: [] }));
  assert.notEqual((await editorialReview({ ...fields, seo_title: 'Nouveau SEO' }, 'admin-id')).hash, review.hash);
  assert.equal(fields.data.editorialReview.hash, 'old');
  await assert.rejects(editorialReview(fields, ''), /INVALID_REVIEW/);
});
