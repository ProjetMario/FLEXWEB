import { fullSearchSummary, applicationSearchSummary } from "../data/search-summary";
export const GET = () => new Response(fullSearchSummary + "\n" + applicationSearchSummary + "\n", {
  headers: { "Content-Type": "text/plain; charset=utf-8" },
});
