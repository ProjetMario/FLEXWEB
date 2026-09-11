/** Explicit price basis stored with each proposal; never infer tax from today’s catalogue. */
export const TTC_QUOTE_VERSION = "2026-09-11-ttc";
export const LEGACY_QUOTE_VERSION = "2026-09-11";
export type QuoteSnapshot = { taxBasis?: string; publicQuote?: { version?: string } };
export function isPublicQuote(snapshot?: QuoteSnapshot | null): boolean {
  return [LEGACY_QUOTE_VERSION, TTC_QUOTE_VERSION].includes(snapshot?.publicQuote?.version || "");
}
export function isInclusiveQuote(snapshot?: QuoteSnapshot | null): boolean {
  return snapshot?.publicQuote?.version === TTC_QUOTE_VERSION && snapshot.taxBasis === "TTC";
}
export const quoteTaxLabel = (snapshot?: QuoteSnapshot | null) => isInclusiveQuote(snapshot) ? "TTC" : "HT";
