import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { prisma } from "../prisma";
import { HttpError } from "../automation/core";
import { lockSite, ownSite } from "./service";
import { editable, paid } from "./core";
import type { Identity } from "./auth";
export async function upload(identity: Identity, data: Uint8Array) {
  if (data.length > 4000000)
    throw new HttpError(413, "Photo trop lourde : 4 Mo maximum.");
  const s = await ownSite(identity);
  if (!editable(s)) throw new HttpError(403, "Votre essai est terminé.");
  const { default: sharp } = await import("sharp");
  const pipeline = sharp(data, { limitInputPixels: 16000000 });
  const metadata = await pipeline.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
    throw new HttpError(400, "Utilisez une image JPEG, PNG ou WebP.");
  const buffer = await pipeline
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  const id = randomUUID(),
    key = `${s.id}/${id}.webp`;
  await prisma.$transaction(async (tx) => {
    await lockSite(tx, s.id);
    const bytes = await tx.studioAsset.aggregate({
      where: { siteId: s.id },
      _sum: { bytes: true },
    });
    if (
      (bytes._sum.bytes || 0) + buffer.length >
      (paid(s) ? 200000000 : 50000000)
    )
      throw new HttpError(413, "La limite de stockage du site est atteinte.");
    await tx.studioAsset.create({
      data: { id, siteId: s.id, key, bytes: buffer.length },
    });
  });
  try {
    await getStore({ name: "studio-media", consistency: "strong" }).set(
      key,
      new Uint8Array(buffer).buffer,
    );
    await prisma.studioAsset.update({
      where: { id },
      data: { state: "READY" },
    });
  } catch {
    await prisma.studioAsset.delete({ where: { id } });
    throw new HttpError(503, "La photo n’a pas été enregistrée. Réessayez.");
  }
  return { id };
}
