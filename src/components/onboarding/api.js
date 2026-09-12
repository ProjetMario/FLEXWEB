export async function api(action, body = {}, token) {
  const response = await fetch(`/api/automation/${action}`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Le parcours en ligne est indisponible. Contactez contact@flex-web.fr pour démarrer votre projet.",
    );
  }
  if (!response.ok) {
    const detail = data.fields
      ? Object.values(data.fields).flat().join(" ")
      : "";
    throw new Error(
      detail || data.error || "La demande n’a pas pu être enregistrée.",
    );
  }
  return data;
}
export const money = (cents) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export function createIdentity() {
  return {
    requestKey: crypto.randomUUID(),
    accessToken: [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}
export function saveToken(token) {
  try {
    sessionStorage.setItem("flexweb-project", token);
  } catch {
    /* The fragment remains a fallback. */
  }
}
export function readToken() {
  try {
    return sessionStorage.getItem("flexweb-project") || "";
  } catch {
    return "";
  }
}
