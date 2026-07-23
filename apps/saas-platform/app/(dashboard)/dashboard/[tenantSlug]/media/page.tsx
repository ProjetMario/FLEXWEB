import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

async function getOrganization(slug: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organization: { slug },
    },
    include: {
      organization: {
        include: {
          media: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  return membership;
}

export default async function OrganizationMediaPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { tenantSlug } = await params;
  const membership = await getOrganization(tenantSlug, session.user.id);

  if (!membership) {
    notFound();
  }

  const canManageMedia = hasPermission(membership.role, "media:manage");
  if (!canManageMedia) {
    redirect(`/dashboard/${tenantSlug}`);
  }

  const { media } = membership.organization;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Médias</h1>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Fichiers</h2>
        {media.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun média importé.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((file) => (
              <li
                key={file.id}
                className="rounded-md border p-3"
              >
                <p className="truncate text-sm font-medium">{file.filename}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.mimeType} · {(file.sizeInBytes / 1024).toFixed(1)} ko
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
