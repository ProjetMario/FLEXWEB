import { fullSearchSummary } from "../data/search-summary";
export const GET = () => new Response(fullSearchSummary, {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
});
