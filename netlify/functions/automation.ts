import { createHmac } from "node:crypto";
import type { Config, Context } from "@netlify/functions";

const respond = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export default async (request: Request, context: Context) => {
  const deployContext = Netlify.env.get("CONTEXT");
  if (deployContext === "deploy-preview" || deployContext === "branch-deploy")
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
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin)
    return respond("Origine non autorisée.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return respond("Format non accepté.", 415);
  const base = Netlify.env.get("AUTOMATION_API_URL");
  const secret = Netlify.env.get("AUTOMATION_SHARED_SECRET");
  if (!base || !secret || secret.length < 32)
    return respond(
      "Le parcours en ligne est en cours d’activation. Contactez contact@flex-web.fr pour démarrer votre projet.",
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
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return respond(
      "Connexion interrompue. Réessayez ou contactez contact@flex-web.fr.",
      503,
    );
  }
};
export const config: Config = { path: "/api/automation/:action" };
