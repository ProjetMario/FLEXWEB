import { getStore } from "@netlify/blobs";
import { prisma } from "@/lib/prisma";
import { studioIdentity } from "@/lib/studio/auth";
import { assetIds, visible, type Snapshot } from "@/lib/studio/core";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const asset = await prisma.studioAsset.findUnique({
    where: { id },
    include: { site: true },
  });
  if (!asset || asset.state !== "READY")
    return new Response("Not found", { status: 404 });
  const isPublic =
    visible(asset.site) &&
    assetIds(asset.site.published as unknown as Snapshot).includes(id);
  if (!isPublic) {
    try {
      if ((await studioIdentity()).id !== asset.site.identityId)
        return new Response("Not found", { status: 404 });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  const data = await getStore({
    name: "studio-media",
    consistency: "strong",
  }).get(asset.key, { type: "arrayBuffer" });
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
