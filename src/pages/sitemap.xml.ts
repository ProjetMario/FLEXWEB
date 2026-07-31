import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const site = "https://flex-web.fr";

export const GET: APIRoute = async () => {
  const staticPages = [
    { url: "/", priority: 1.0, changefreq: "weekly" },
    { url: "/about/", priority: 0.8, changefreq: "monthly" },
    { url: "/contact/", priority: 0.8, changefreq: "monthly" },
    { url: "/pricing/", priority: 0.9, changefreq: "monthly" },
    { url: "/journal/combien-coute-site-internet-savoie/", priority: 0.8, changefreq: "yearly" },
    { url: "/journal/comment-choisir-agence-web-chambery/", priority: 0.8, changefreq: "yearly" },
    { url: "/journal/site-internet-artisan-haute-savoie/", priority: 0.8, changefreq: "yearly" },
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

  const allPages = [...staticPages, ...locationPages, ...mobileLocationPages, ...servicePages];

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
