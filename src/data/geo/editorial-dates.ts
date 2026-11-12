// Editorial dates describe reviewed changes, never the time of a rebuild.
// Homepages are deliberately excluded: their content is preserved for this release.
export const editorialDates: Record<string, string> = Object.fromEntries([
  '/creation-site-internet-pas-cher/', '/francophonie/',
  '/en/affordable-websites/', '/en/french-speaking-clients/',
  '/creation-application-mobile/',
  '/automatisation-ia/', '/crm-automatisation-entreprise/',
  '/pricing/', '/about/', '/contact/',
  '/en/websites/', '/en/applications/', '/en/ai-automation/', '/en/crm/',
  '/en/pricing/', '/en/about/', '/en/contact/',
].map(path => [path, '2026-11-03']).concat([['/creation-site-internet/', '2026-11-12']]));

// These edits were already published on 1 November; correct their stale sitemap dates.
export const previouslyReviewedDates: Record<string, string> = {
  '/creation-site-internet-chambery/': '2026-11-05',
  '/creation-site-internet-annecy/': '2026-11-05',
  '/creation-site-internet-savoie/': '2026-11-05',
  '/creation-site-internet-vevey/': '2026-11-01',
};
