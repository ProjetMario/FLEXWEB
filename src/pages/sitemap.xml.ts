import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const site = "https://flex-web.fr";

export const GET: APIRoute = async () => {
  const staticPages = [
    { url: "/", priority: 1.0, changefreq: "weekly" },
    { url: "/about/", priority: 0.8, changefreq: "monthly" },
    { url: "/contact/", priority: 0.8, changefreq: "monthly" },
    { url: "/journal/", priority: 0.9, changefreq: "weekly" },
    { url: "/products/", priority: 0.9, changefreq: "weekly" },
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

  const servicePages = services
    .filter(({ data }) => data.slug === "creation-site-internet")
    .map(({ data }) => ({
      url: `/${data.slug}/`,
      priority: 0.8,
      changefreq: "monthly",
    }));

  const allPages = [...staticPages, ...locationPages, ...servicePages];
  const lastmod = new Date().toISOString().split("T")[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    ({ url, priority, changefreq }) => `  <url>
    <loc>${site}${url}</loc>
    <lastmod>${lastmod}</lastmod>
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
