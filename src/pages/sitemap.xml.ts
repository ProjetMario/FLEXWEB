import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import journalData from "../data/journalArticles.json";
import { isIndexableMobileLocation, mobileLocationPath } from "../data/location-indexing";

const site = "https://flex-web.fr";

export const GET: APIRoute = async () => {
  const staticPages = [
    { url: "/", priority: 1.0, changefreq: "weekly" },
    { url: "/about/", priority: 0.8, changefreq: "monthly" },
    { url: "/contact/", priority: 0.8, changefreq: "monthly" },
    { url: "/pricing/", priority: 0.9, changefreq: "monthly" },
    { url: "/automatisation-ia/", priority: 0.9, changefreq: "monthly" },
    { url: "/automatisation-ia-savoie/", priority: 0.8, changefreq: "monthly" },
    { url: "/automatisation-ia-haute-savoie/", priority: 0.8, changefreq: "monthly" },
    { url: "/creation-site-internet/", priority: 0.9, changefreq: "monthly" },
    { url: "/creation-application-mobile/", priority: 0.9, changefreq: "monthly" },
    { url: "/journal/", priority: 0.8, changefreq: "weekly" },
    { url: "/privacy/", priority: 0.5, changefreq: "yearly" },
    { url: "/mentions-legales/", priority: 0.5, changefreq: "yearly" },
    { url: "/cgv/", priority: 0.5, changefreq: "yearly" },
  ];

  const [locations, services] = await Promise.all([
    getCollection("locations", ({ data }) => !data.isDraft),
    getCollection("services", ({ data }) => !data.isDraft),
  ]);

  const locationPages = locations.map(({ data }) => ({
    url: `/${data.slug}/`,
    priority: 0.7,
    changefreq: "monthly",
  }));

  const mobileLocationPages = locations.filter(({data}) => isIndexableMobileLocation(data)).map(({ data }) => ({
    url: mobileLocationPath(data),
    priority: 0.7,
    changefreq: "monthly",
  }));

  const servicePages = services.map((entry) => ({
    url: `/${entry.id}/`,
    priority: 0.8,
    changefreq: "monthly",
  }));

  const journalPages = journalData
    .filter((item) => item.slug)
    .map((item) => ({
      url: `/journal/${item.slug}/`,
      priority: 0.7,
      changefreq: "yearly",
    }));

  const candidates = [
    ...staticPages,
    ...locationPages,
    ...mobileLocationPages,
    ...servicePages,
    ...journalPages,
  ];
  const allPages = Array.from(new Map(candidates.map(page => [page.url, page])).values());

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    ({ url, priority, changefreq }) => `  <url>
    <loc>${site}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
};
