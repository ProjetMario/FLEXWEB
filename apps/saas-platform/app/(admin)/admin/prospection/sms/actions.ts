"use server";
import { requireAdmin } from "@/lib/prospection/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addContact,
  createConnectionKeys,
  saveSms,
  setSmsEnabled,
  stopSms,
  reconcileSms,
} from "@/lib/sms/service";
import { SmsInputError, SMS_BASE } from "@/lib/sms/core";
import { ZodError } from "zod";
function errorText(e: unknown) {
  return e instanceof SmsInputError
    ? e.message
    : e instanceof ZodError
      ? "Vérifiez les champs, le lien d’information et la mention STOP."
      : "Action impossible. Réessayez ou consultez le journal.";
}
export async function connectionAction() {
  await requireAdmin();
  try {
    const keys = await createConnectionKeys();
    revalidatePath(SMS_BASE);
    return { ...keys, error: "" };
  } catch (e) {
    return { webhookKey: "", dispatchKey: "", error: errorText(e) };
  }
}
export async function smsAction(form: FormData) {
  const user = await requireAdmin();
  let message = "Modifications enregistrées.",
    error = false;
  try {
    const action = String(form.get("action"));
    const id = String(form.get("id") || "");
    if (action === "add") {
      await addContact(form);
      message = "Entreprise ajoutée. Son SMS reste en brouillon.";
    } else if (action === "save" || action === "approve")
      await saveSms(id, form, user.id);
    else if (action === "reconcile") await reconcileSms(id, form);
    else if (action === "stop" || action === "close")
      await stopSms(id, action === "stop" ? "STOP" : "CLOSED");
    else if (action === "enable" || action === "pause") {
      if (action === "enable" && form.get("confirm") !== "on")
        throw new SmsInputError(
          "Confirmez l’activation de la file de SMS validés.",
        );
      await setSmsEnabled(action === "enable");
      message =
        action === "enable"
          ? "La file de SMS validés est active en journée."
          : "Envois en pause.";
    } else throw new SmsInputError("Action inconnue.");
  } catch (e) {
    message = errorText(e);
    error = true;
  }
  revalidatePath(SMS_BASE);
  redirect(
    `${SMS_BASE}?${error ? "error" : "saved"}=${encodeURIComponent(message)}`,
  );
}
