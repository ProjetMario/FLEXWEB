import type { Config } from "@netlify/functions";

// These unrelated template articles have no equivalent on Flex-Web.
// Exact paths only: never retire another journal article through a wildcard.
export const config: Config = {
  path: [
    "/journal/dyson-pencilvac",
    "/journal/dyson-pencilvac/",
    "/journal/dyson-zone",
    "/journal/dyson-zone/",
    "/journal/dyson-360-vis-nav",
    "/journal/dyson-360-vis-nav/",
    "/journal/dyson-microfan",
    "/journal/dyson-microfan/",
    "/journal/wearable-air-purifier",
    "/journal/wearable-air-purifier/",
    "/journal/supersonic-r-hair-dryer",
    "/journal/supersonic-r-hair-dryer/",
  ],
};

const retiredPaths = new Set(config.path as string[]);
const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Article retiré — Flex-Web</title>
<style>
body{margin:0;background:#f5f7fa;color:#172133;font:1.1rem/1.65 system-ui,sans-serif}
main{max-width:42rem;margin:10vh auto;padding:2rem;background:#fff;border-radius:1.5rem}
h1{font-size:clamp(1.8rem,6vw,3rem);line-height:1.15}a{color:#0057c2;text-underline-offset:.2em}
a:focus-visible{outline:3px solid #0057c2;outline-offset:5px}nav{display:flex;flex-wrap:wrap;gap:1rem 2rem}
@media(max-width:48rem){main{margin:2rem 1rem;padding:1.5rem}}
</style></head><body><main>
<p>Flex-Web · Article retiré</p><h1>Cet article n’est plus disponible.</h1>
<p>Cette ancienne publication consacrée à un produit a été retirée définitivement. Elle ne correspond pas aux prestations de Flex-Web.</p>
<p>Vous pouvez découvrir nos services ou consulter nos guides sur les sites internet et l’automatisation.</p>
<nav aria-label="Continuer sur Flex-Web"><a href="/">Voir les prestations</a><a href="/journal/">Consulter les guides</a></nav>
</main></body></html>`;

export default async (request: Request) => {
  if (!retiredPaths.has(new URL(request.url).pathname))
    return new Response(null, { status: 404 });
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  return new Response(request.method === "HEAD" ? null : html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      "Cache-Control": "public, max-age=3600",
      "Netlify-CDN-Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
};
