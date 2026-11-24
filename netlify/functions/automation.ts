import { createHmac } from "node:crypto";
import type { Config, Context } from "@netlify/functions";

const respond = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
// The upstream CRM can be released independently. Translate its previous public
// error messages without rewriting visitor data or successful private responses.
const previousErrors = new Map([
  ["Lien privé invalide ou expiré. Contactez contact@flex-web.fr.", "Lien privé invalide ou expiré. Pour demander de l’aide, utilisez le formulaire sur https://flex-web.fr/contact/."],
  ["Contactez contact@flex-web.fr pour toute question avant commande.", "Pour toute question avant commande, utilisez le formulaire sur https://flex-web.fr/contact/."],
  ["Le service est momentanément indisponible. Vos saisies sont conservées à l’écran. Contactez contact@flex-web.fr si le problème persiste.", "Le service est momentanément indisponible. Vos saisies sont conservées à l’écran. Si le problème persiste, utilisez le formulaire sur https://flex-web.fr/contact/."],
]);
export default async (request: Request, context: Context) => {
  // A promoted manual deploy may retain its original preview metadata. Only
  // Netlify's canonical request URL may forward requests to the live service;
  // a client-supplied Origin header never authorizes an immutable preview URL.
  const url = new URL(request.url);
  if (url.origin !== "https://flex-web.fr")
    return respond(
      "Les demandes sont désactivées dans cet aperçu. Utilisez flex-web.fr pour envoyer votre projet.",
      503,
    );
  const actions = new Set([
    "intake",
    "status",
    "checkout",
    "billing",
    "brief",
    "approve",
    "support",
  ]);
  if (request.method !== "POST") return respond("Méthode non acceptée.", 405);
  if (!actions.has(context.params.action))
    return respond("Action inconnue.", 404);
  if (request.headers.get("origin") !== url.origin)
    return respond("Origine non autorisée.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return respond("Format non accepté.", 415);
  const base = Netlify.env.get("AUTOMATION_API_URL");
  const secret = Netlify.env.get("AUTOMATION_SHARED_SECRET");
  if (!base || !secret || secret.length < 32)
    return respond(
      "Le parcours en ligne est en cours d’activation. Pour décrire votre projet, utilisez le formulaire sur https://flex-web.fr/contact/.",
      503,
    );
  if (
    !base.startsWith("https://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)
  )
    return respond("Configuration du service à vérifier.", 503);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 24000)
    return respond("Votre demande est trop volumineuse.", 413);
  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/automation/${context.params.action}`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(40000),
        body,
        headers: {
          "Content-Type": "application/json",
          "x-automation-secret": secret,
          "x-visitor-key": createHmac("sha256", secret)
            .update(context.ip || "local")
            .digest("hex"),
          Authorization: request.headers.get("authorization") || "",
        },
      },
    );
    if (!response.headers.get("content-type")?.includes("application/json"))
      return respond("Le service est momentanément indisponible.", 502);
    let content = await response.text();
    if (!response.ok && content.includes("contact@flex-web.fr")) {
      try {
        const data = JSON.parse(content);
        if (previousErrors.has(data?.error)) {
          data.error = previousErrors.get(data.error);
          content = JSON.stringify(data);
        }
      } catch { /* Preserve an unrecognized upstream response. */ }
    }
    return new Response(content, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return respond(
      "Connexion interrompue. Réessayez dans quelques instants. Si le problème persiste, utilisez le formulaire sur https://flex-web.fr/contact/.",
      503,
    );
  }
};
export const config: Config = { path: "/api/automation/:action" };
