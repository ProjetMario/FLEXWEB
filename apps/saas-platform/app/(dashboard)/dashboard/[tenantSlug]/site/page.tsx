import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { publishWebsite, unpublishWebsite } from "@/lib/actions/website";

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

export default async function OrganizationSitePage({
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

  const canManageWebsite = hasPermission(membership.role, "websites:manage");
  if (!canManageWebsite) {
    redirect(`/dashboard/${tenantSlug}`);
  }

  const { organization } = membership;
  const website = organization.websites[0];

  if (!website) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Site web</h1>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-muted-foreground">Aucun site web configuré.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Site web</h1>
        <Link
          href={`/dashboard/${tenantSlug}/pages`}
          className={buttonVariants()}
        >
          Gérer les pages
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">{website.name}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Statut</dt>
            <dd className="flex items-center gap-3 font-medium">
              {website.isPublished ? "Publié" : "Brouillon"}
              {website.isPublished ? (
                <form action={unpublishWebsite.bind(null, tenantSlug, website.id)}>
                  <button
                    type="submit"
                    className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80"
                  >
                    Dépublier
                  </button>
                </form>
              ) : (
                <form action={publishWebsite.bind(null, tenantSlug, website.id)}>
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Publier
                  </button>
                </form>
              )}
            </dd>
          </div>
          {website.primaryDomain && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Domaine principal</dt>
              <dd className="font-medium">{website.primaryDomain}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Pages</h2>
        {website.pages.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucune page créée.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {website.pages.map((page) => (
              <li key={page.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{page.title}</p>
                  <p className="text-sm text-muted-foreground">/{page.slug}</p>
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
