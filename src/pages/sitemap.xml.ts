import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import journalData from "../data/journal.json";

const site = "https://flex-web.fr";

export const GET: APIRoute = async () => {
  const staticPages = [
    { url: "/", priority: 1.0, changefreq: "weekly" },
    { url: "/about/", priority: 0.8, changefreq: "monthly" },
    { url: "/contact/", priority: 0.8, changefreq: "monthly" },
    { url: "/pricing/", priority: 0.9, changefreq: "monthly" },
    { url: "/journal/", priority: 0.8, changefreq: "weekly" },
    { url: "/products/", priority: 0.8, changefreq: "weekly" },
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

  const mobileLocationPages = locations.map(({ data }) => ({
    url: `/creation-application-mobile-${data.slug.replace("creation-site-internet-", "")}/`,
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

  const productPages = journalData
    .filter((item) => item.slug)
    .map((item) => ({
      url: `/products/${item.slug}/`,
      priority: 0.7,
      changefreq: "yearly",
    }));

  const allPages = [
    ...staticPages,
    ...locationPages,
    ...mobileLocationPages,
    ...servicePages,
    ...journalPages,
    ...productPages,
  ];

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
