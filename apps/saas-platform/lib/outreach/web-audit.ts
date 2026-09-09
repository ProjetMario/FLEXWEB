import { resolve4, resolve6 } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import type { Audit } from "./core";

const AGENT = "FlexWebDiagnostic";
export function publicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export function webUrl(value: string) {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) ||
    url.hostname.length > 253 ||
    url.hostname === "localhost" ||
    !url.hostname.includes(".") ||
    ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ""))
  )
    throw new Error("Adresse de site public invalide.");
  url.hash = "";
  return url;
}
// Pin the already validated DNS answer into the socket lookup: redirects and
// DNS rebinding cannot turn this diagnostic into an internal-network request.
export async function publicGet(
  input: string,
  deadline = Date.now() + 6500,
  redirects = 0,
): Promise<{ url: string; status: number; type: string; body: string }> {
  const url = webUrl(input);
  if (Date.now() >= deadline) throw new Error("Délai du diagnostic dépassé.");
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error("DNS trop lent.")),
      Math.max(1, deadline - Date.now()),
    );
    timer.unref();
  });
  const addresses = await Promise.race([
    Promise.allSettled([resolve4(url.hostname), resolve6(url.hostname)]).then(
      (results) =>
        results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    ),
    timeout,
  ]);
  if (!addresses.length || addresses.some((a) => !publicAddress(a)))
    throw new Error("Hôte non public ou inaccessible.");
  const address = addresses[0];
  const family = ipaddr.parse(address).kind() === "ipv4" ? 4 : 6;
  const result = await new Promise<{
    status: number;
    type: string;
    body: string;
    location?: string;
  }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        },
        headers: {
          "User-Agent": `${AGENT}/1.0 (+https://flex-web.fr; contact@flex-web.fr)`,
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Encoding": "identity",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let length = 0;
        response.on("data", (chunk: Buffer) => {
          length += chunk.length;
          if (length > 512_000)
            request.destroy(new Error("Page trop volumineuse."));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode || 0,
            type: String(response.headers["content-type"] || ""),
            body: Buffer.concat(chunks).toString("utf8"),
            location: response.headers.location,
          }),
        );
      },
    );
    const timer = setTimeout(
      () => request.destroy(new Error("Site trop lent pour ce contrôle.")),
      Math.max(1, deadline - Date.now()),
    );
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end();
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
    if (redirects >= 3) throw new Error("Trop de redirections.");
    return publicGet(
      new URL(result.location, url).href,
      deadline,
      redirects + 1,
    );
  }
  return { ...result, url: url.href };
}
export function inspectHtml(body: string, url: string): Audit["findings"] {
  const $ = cheerio.load(body);
  const findings: Audit["findings"] = [];
  if (!$('meta[name="viewport"]').length)
    findings.push({
      label: "Balise viewport non détectée sur la page examinée",
      evidence: `${url} — aucun meta[name="viewport"] dans le HTML reçu ; l’affichage mobile reste à vérifier.`,
    });
  if (!$('a[href^="tel:"]').length)
    findings.push({
      label: "Lien téléphonique cliquable non détecté sur la page examinée",
      evidence: `${url} — aucun lien tel: dans le HTML reçu.`,
    });
  if (!$("form").length)
    findings.push({
      label: "Formulaire non détecté dans le HTML de la page examinée",
      evidence: `${url} — aucun élément form ; les formulaires chargés en JavaScript ou sur d’autres pages ne sont pas couverts.`,
    });
  return findings;
}
export async function auditWebsite(website: string): Promise<Audit> {
  const url = webUrl(website);
  const deadline = Date.now() + 11000;
  const robots = await publicGet(
    new URL("/robots.txt", url).href,
    Math.min(deadline, Date.now() + 3500),
  );
  if (
    robots.status !== 404 &&
    robots.status !== 410 &&
    (robots.status < 200 || robots.status >= 300)
  )
    throw new Error(
      "Règles d’exploration indisponibles ; vérification manuelle requise.",
    );
  const rules = robotsParser(
    new URL("/robots.txt", url).href,
    robots.status === 200 ? robots.body : "",
  );
  if (rules.isAllowed(url.href, AGENT) === false)
    throw new Error("Ce site refuse le diagnostic automatique.");
  const page = await publicGet(url.href, deadline);
  // A redirect to another origin requires checking that origin's rules first.
  if (new URL(page.url).origin !== url.origin) {
    const r = await publicGet(new URL("/robots.txt", page.url).href, deadline);
    if (
      (r.status !== 404 && r.status !== 410 && r.status !== 200) ||
      robotsParser(
        new URL("/robots.txt", page.url).href,
        r.status === 200 ? r.body : "",
      ).isAllowed(page.url, AGENT) === false
    )
      throw new Error("Règles du site de destination à vérifier.");
  }
  if (page.status !== 200 || !page.type.includes("text/html"))
    throw new Error(
      "Page non analysable automatiquement ; disponibilité à vérifier manuellement.",
    );
  return {
    checkedAt: new Date().toISOString(),
    pages: [page.url],
    findings: inspectHtml(page.body, page.url),
    note: "Contrôle du HTML de la page d’accueil. Aucun navigateur mobile, formulaire dynamique, mesure SEO ou test d’envoi de devis n’a été exécuté. Vérifier chaque conclusion avant le contact.",
  };
}
