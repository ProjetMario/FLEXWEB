/** Explicit price basis stored with each proposal; never infer tax from today’s catalogue. */
export const TTC_QUOTE_VERSION = "2026-09-24-ttc";
export const PREVIOUS_TTC_QUOTE_VERSION = "2026-09-11-ttc";
export const LEGACY_QUOTE_VERSION = "2026-09-11";
export const INCLUSIVE_QUOTE_VERSIONS = [PREVIOUS_TTC_QUOTE_VERSION, TTC_QUOTE_VERSION] as const;
export const PUBLIC_QUOTE_VERSIONS = [LEGACY_QUOTE_VERSION, ...INCLUSIVE_QUOTE_VERSIONS] as const;
export type QuoteSnapshot = { taxBasis?: string; publicQuote?: { version?: string } };
export function isPublicQuote(snapshot?: QuoteSnapshot | null): boolean {
  return PUBLIC_QUOTE_VERSIONS.some((version) => version === snapshot?.publicQuote?.version);
}
export function usesInclusiveQuoteVersion(snapshot?: QuoteSnapshot | null): boolean {
  return INCLUSIVE_QUOTE_VERSIONS.some((version) => version === snapshot?.publicQuote?.version);
}
export function isInclusiveQuote(snapshot?: QuoteSnapshot | null): boolean {
  return usesInclusiveQuoteVersion(snapshot) && snapshot?.taxBasis === "TTC";
}
export const quoteTaxLabel = (snapshot?: QuoteSnapshot | null) => isInclusiveQuote(snapshot) ? "TTC" : "HT";
