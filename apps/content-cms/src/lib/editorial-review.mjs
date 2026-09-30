function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

export async function editorialReview(fields, reviewer, reviewedAt = new Date().toISOString()) {
  if (typeof reviewer !== 'string' || !reviewer.trim() || !Array.isArray(fields.content) || !Number.isFinite(Date.parse(reviewedAt))) throw new Error('INVALID_REVIEW');
  const payload = { content: fields.content, seoTitle: fields.seo_title || '', seoDescription: fields.seo_description || '', additionalSections: fields.data?.additionalSections ?? [] };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(payload)));
  return { hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''), reviewer, reviewedAt };
}
