import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const SMS_BASE = "/admin/prospection/sms";
export const ONOFF_NUMBER = "+33757830262";
export const smsStatuses: Record<string, string> = {
  DRAFT: "Brouillon à vérifier",
  APPROVED: "Prêt pour la file",
  DISPATCHED: "Transmis à l’automatisation",
  REVIEW: "Envoi à vérifier dans Onoff",
  SENT: "Envoi confirmé par Onoff",
  SKIPPED: "Arrêté",
};
export class SmsInputError extends Error {}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function keyMatches(key: string | null, expected?: string | null) {
  if (
    !key ||
    key.length < 32 ||
    key.length > 200 ||
    !expected ||
    !/^[a-f0-9]{64}$/.test(expected)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(hash(key), "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function mobileNumber(value: string) {
  let phone = value.replace(/[\s().-]/g, "");
  if (phone.startsWith("0033")) phone = "+33" + phone.slice(4);
  if (/^33[67]\d{8}$/.test(phone)) phone = "+" + phone;
  if (/^0[67]\d{8}$/.test(phone)) phone = "+33" + phone.slice(1);
  if (!/^\+33[67]\d{8}$/.test(phone))
    throw new SmsInputError(
      "Renseignez un mobile professionnel français valide (06 ou 07). Les numéros fixes sont exclus.",
    );
  return phone;
}
const gsm = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const extended = new Set(Array.from("^{}\\[~]|€\f"));
export function smsLength(text: string) {
  const unicode = Array.from(text).some((c) => !gsm.has(c) && !extended.has(c));
  const units = unicode
    ? text.length
    : Array.from(text).reduce((n, c) => n + (extended.has(c) ? 2 : 1), 0);
  const single = unicode ? 70 : 160;
  return {
    encoding: unicode ? "Unicode" : "GSM",
    segments: units <= single ? 1 : Math.ceil(units / (unicode ? 67 : 153)),
    units,
  };
}
export const textSchema = z
  .string()
  .trim()
  .min(25)
  .max(450)
  .refine(
    (text) =>
      /FLEX-WEB/i.test(text) &&
      /\bSTOP\b/i.test(text) &&
      text.includes("flex-web.fr/privacy/"),
    "Le message doit identifier FLEX-WEB, inclure STOP et le lien flex-web.fr/privacy/.",
  );
export function defaultSms(company: string) {
  return `Bonjour, Mario de FLEX-WEB. J'ai trouve ${company.slice(0, 50)} sur Google. Un site pour presenter vos realisations et recevoir des demandes de devis vous serait-il utile ? Infos : flex-web.fr/privacy/ Repondez STOP pour ne plus etre contacte.`;
}
export function isOpposition(body: string) {
  const t = body
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\b(stop|desinscri\w*|unsubscribe|retire\w*|supprim\w*|refus\w*)\b/.test(
      t,
    ) ||
    /ne (me |nous )?(contact|sollicit|envo)|plus de (sms|message)|pas interesse/.test(
      t,
    )
  );
}
export const onoffPayload = z.object({
  id: z.string().min(1).max(150),
  eventName: z.literal("SMS"),
  onoffUserNumber: z.string().max(60),
  externalNumber: z.string().max(60),
  date: z.string().datetime({ offset: true }),
  smsDirection: z.enum(["SENT", "RECEIVED"]),
  body: z.string().max(10000),
});
export async function limitedJson(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 32768)
    throw new SmsInputError("Message trop volumineux.");
  const reader = request.body?.getReader();
  if (!reader) throw new SmsInputError("Corps manquant.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw new SmsInputError("Message trop volumineux.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
