import { searchSummary } from "../data/search-summary";
export const GET = () => new Response(searchSummary, {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
});
