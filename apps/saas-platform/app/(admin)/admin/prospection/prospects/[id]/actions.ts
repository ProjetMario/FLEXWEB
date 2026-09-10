"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import { crmLock, stopCrmSequences } from "@/lib/prospection/crm-service";
import { InteractionType, ProspectionStatus } from "@prisma/client";

const statusUpdateSchema = z.object({
  prospectId: z.string().uuid(),
  status: z.enum(ProspectionStatus),
  note: z.string().optional(),
});

export async function updateProspectStatus(formData: FormData) {
  const user = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = statusUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides" };
  }

  const { prospectId, status, note } = parsed.data;

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });
  if (!prospect) {
    return { ok: false, error: "Prospect introuvable" };
  }

  const oldStatus = prospect.status;

  await prisma.$transaction(async (tx) => {
    await crmLock(tx);
    const fresh = await tx.prospect.findUniqueOrThrow({
      where: { id: prospectId },
    });
    if (
      fresh.doNotContactAt &&
      status !== "PAS_INTERESSE" &&
      status !== "CLIENT_SIGNE"
    )
      throw Error("Cette entreprise a demandé à ne plus être contactée.");
    if (
      ![
        "NOUVEAU",
        "A_CONTACTER",
        "SANS_REPONSE",
        "SMS_ENVOYE",
        "A_RELANCER",
      ].includes(status)
    )
      await stopCrmSequences(
        tx,
        prospectId,
        `CRM_${status}`,
        status === "PAS_INTERESSE",
      );
    await tx.prospect.update({
      where: { id: prospectId },
      data: {
        status,
        lastInteractionAt: new Date(),
        signedValue:
          status === "CLIENT_SIGNE"
            ? (prospect.estimatedValue ?? null)
            : prospect.signedValue,
      },
    });

    await tx.prospectInteraction.create({
      data: {
        prospectId,
        type: InteractionType.STATUT_MODIFIE,
        note: note || `Statut mis à jour par ${user.email}`,
        oldStatus,
        newStatus: status,
        createdById: user.id,
      },
    });
  });

  revalidatePath(`/admin/prospection/prospects/${prospectId}`);
  return { ok: true };
}

const interactionSchema = z.object({
  prospectId: z.string().uuid(),
  type: z.enum(InteractionType),
  note: z.string().optional(),
});

export async function addInteraction(formData: FormData) {
  const user = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides" };
  }

  const { prospectId, type, note } = parsed.data;

  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });
  if (!prospect) {
    return { ok: false, error: "Prospect introuvable" };
  }

  await prisma.prospectInteraction.create({
    data: {
      prospectId,
      type,
      note: note || `${type} enregistré(e) par ${user.email}`,
      oldStatus: prospect.status,
      newStatus: prospect.status,
      createdById: user.id,
    },
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { lastInteractionAt: new Date() },
  });

  revalidatePath(`/admin/prospection/prospects/${prospectId}`);
  return { ok: true };
}

const followUpSchema = z.object({
  prospectId: z.string().uuid(),
  dueAt: z.string().datetime(),
  note: z.string().optional(),
});

export async function scheduleFollowUp(formData: FormData) {
  const user = await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = followUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides" };
  }

  const { prospectId, dueAt, note } = parsed.data;

  await prisma.followUp.create({
    data: {
      prospectId,
      dueAt: new Date(dueAt),
      note: note || null,
      createdById: user.id,
    },
  });

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { nextFollowUpAt: new Date(dueAt) },
  });

  revalidatePath(`/admin/prospection/prospects/${prospectId}`);
  return { ok: true };
}
