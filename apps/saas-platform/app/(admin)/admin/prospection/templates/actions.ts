"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import { textSchema } from "@/lib/sms/core";
export async function saveTemplate(form: FormData) {
  await requireAdmin();
  let error = "";
  try {
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        channel: z.enum(["SMS", "EMAIL"]),
        subject: z
          .string()
          .trim()
          .max(180)
          .regex(/^[^\r\n]*$/),
        body: z.string().trim().min(25).max(5000),
      })
      .parse(Object.fromEntries(form));
    if (data.channel === "SMS") textSchema.parse(data.body);
    if (data.channel === "EMAIL" && data.subject.length < 3)
      throw Error("Renseignez un objet pour le modèle e-mail.");
    if (
      /\{\{(?!entreprise\}\}|ville\}\}|activite\}\})/.test(
        data.body + data.subject,
      )
    )
      throw Error("Variables disponibles : entreprise, ville et activite.");
    const id = form.get("id");
    if (id)
      await prisma.crmMessageTemplate.update({
        where: { id: z.uuid().parse(id) },
        data,
      });
    else await prisma.crmMessageTemplate.create({ data });
  } catch (e) {
    error =
      e instanceof z.ZodError
        ? "Vérifiez les champs. Un modèle SMS doit contenir FLEX-WEB, STOP et flex-web.fr/privacy/."
        : e instanceof Error && !e.message.includes("prisma")
          ? e.message
          : "Enregistrement impossible.";
  }
  revalidatePath("/admin/prospection", "layout");
  redirect(
    `/admin/prospection/templates?${error ? "error=" + encodeURIComponent(error) : "saved=1"}`,
  );
}
