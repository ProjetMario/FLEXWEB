import { cookies } from "next/headers";
import { APP } from "./core";
import { HttpError } from "../automation/core";
export type Identity = { id: string; email: string };
export async function studioIdentity(): Promise<Identity> {
  const token = (await cookies()).get("nf_jwt")?.value;
  if (!token || token.length > 12000)
    throw new HttpError(401, "Connectez-vous à votre espace.");
  // Validate against Identity on every request; never trust unsigned cookie claims or browser metadata.
  const response = await fetch(`${APP()}/.netlify/identity/user`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new HttpError(401, "Votre connexion a expiré. Reconnectez-vous.");
  const user = await response.json();
  if (!user.id || !user.email || !user.confirmed_at)
    throw new HttpError(
      403,
      "Confirmez votre adresse e-mail avant de créer votre site.",
    );
  return { id: user.id, email: user.email.toLowerCase() };
}
export function checkOrigin(request: Request, publicForm = false) {
  const allowed = [
    APP(),
    ...(publicForm ? [process.env.MARKETING_URL || "https://flex-web.fr"] : []),
  ];
  const origin = request.headers.get("origin");
  if (!origin || !allowed.includes(origin))
    throw new HttpError(403, "Origine refusée.");
}
export function pilotAllowed(email: string) {
  return (
    process.env.STUDIO_OPEN_SIGNUP === "true" ||
    (process.env.STUDIO_PILOT_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(email)
  );
}
