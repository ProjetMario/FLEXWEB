import { getCollection } from "astro:content";
import journalData from "../../data/journalArticles.json";
import { isIndexableMobileLocation, mobileLocationPath } from "../../data/location-indexing";

import { realizations } from "../../data/realizations";

const site = "https://flex-web.fr";
const updatedPages: Record<string, string> = {
  "/creation-site-internet-montmelian/": "2026-09-23",
  "/": "2026-09-24",
  "/creation-site-internet/": "2026-09-24",
  "/pricing/": "2026-09-24",
  "/automatisation-ia/": "2026-09-24",
  "/automatisation-ia-savoie/": "2026-09-24",
  "/automatisation-ia-haute-savoie/": "2026-09-24",
  "/creation-application-mobile/": "2026-09-24",
  "/cgv/": "2026-09-24",
  "/journal/combien-coute-site-internet-savoie/": "2026-09-24",
  "/journal/site-internet-artisan-haute-savoie/": "2026-09-24",
  "/zones-intervention/": "2026-09-20",
  "/creation-site-internet-saint-alban-leysse/": "2026-09-20",
  "/creation-site-internet-albertville/": "2026-09-20",
  "/creation-site-internet-annemasse/": "2026-09-20",
};

export const corePages = async () => {
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
    { url: "/zones-intervention/", priority: 0.7, changefreq: "monthly" },
    { url: "/privacy/", priority: 0.5, changefreq: "yearly" },
    { url: "/mentions-legales/", priority: 0.5, changefreq: "yearly" },
    { url: "/cgv/", priority: 0.5, changefreq: "yearly" },
  ];

  const [locations, services] = await Promise.all([
    getCollection("locations", ({ data }) => !data.isDraft),
    getCollection("services", ({ data }) => !data.isDraft),
  ]);

  // All website location FAQs now describe the revised public catalogue.
  for (const {data} of locations) updatedPages[`/${data.slug}/`] = "2026-09-24";

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
    {url:"/realisations/",priority:0.8,changefreq:"monthly"},
    ...realizations.map(p=>({url:`/realisations/${p.slug}/`,priority:0.7,changefreq:"monthly"})),
    ...locationPages,
    ...mobileLocationPages,
    ...servicePages,
    ...journalPages,
  ];
  const allPages = Array.from(new Map(candidates.map(page => [page.url, page])).values());

  return allPages.map(p=>({url:p.url,lastmod:updatedPages[p.url] ?? (p.url.startsWith('/realisations/')?'2026-09-15':undefined),family:p.url.startsWith('/creation-site-internet-')?'territoires':'principal'}));
};
