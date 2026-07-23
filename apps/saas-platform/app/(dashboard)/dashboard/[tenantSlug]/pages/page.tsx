import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import Link from "next/link";
import { CreatePageForm } from "@/components/forms/create-page-form";
import { publishPage, unpublishPage } from "@/lib/actions/pages";

async function getOrganization(slug: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organization: { slug },
    },
    include: {
      organization: {
        include: {
          websites: {
            include: {
              pages: {
                orderBy: [{ isHomepage: "desc" }, { createdAt: "desc" }],
              },
            },
          },
        },
      },
    },
  });

  return membership;
}

export default async function OrganizationPagesPage({
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

  const canManagePages = hasPermission(membership.role, "pages:manage");
  const canPublishPages = hasPermission(membership.role, "pages:publish");
  if (!canManagePages) {
    redirect(`/dashboard/${tenantSlug}`);
  }

  const website = membership.organization.websites[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">Liste des pages</h2>
          {website?.pages.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune page pour le moment.
            </p>
          ) : (
            <ul className="mt-4 divide-y">
              {website?.pages.map((page) => (
                <li
                  key={page.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <Link
                    href={`/dashboard/${tenantSlug}/pages/${page.slug}`}
                    className="font-medium hover:underline"
                  >
                    {page.title}
                  </Link>
                    <p className="text-sm text-muted-foreground">
                      /{page.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                      {page.status.toLowerCase()}
                    </span>
                    {page.isHomepage && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Accueil
                      </span>
                    )}
                    {page.status === "DRAFT" && canPublishPages && (
                      <form action={publishPage.bind(null, tenantSlug, page.id)}>
                        <button
                          type="submit"
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Publier
                        </button>
                      </form>
                    )}
                    {page.status === "PUBLISHED" && canManagePages && (
                      <form action={unpublishPage.bind(null, tenantSlug, page.id)}>
                        <button
                          type="submit"
                          className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                        >
                          Dépublier
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">Créer une page</h2>
          <div className="mt-4">
            <CreatePageForm slug={tenantSlug} />
          </div>
        </div>
      </div>
    </div>
  );
}
