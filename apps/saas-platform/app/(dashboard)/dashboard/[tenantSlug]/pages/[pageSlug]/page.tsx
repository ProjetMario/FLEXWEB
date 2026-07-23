import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { EditPageForm } from "@/components/forms/edit-page-form";
import { deletePage } from "@/lib/actions/pages";

async function getPage(slug: string, pageSlug: string, userId: string) {
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
                where: { slug: pageSlug },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) return null;
  const website = membership.organization.websites[0];
  const page = website?.pages[0];

  if (!page) return null;

  return { membership, page };
}

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; pageSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { tenantSlug, pageSlug } = await params;
  const result = await getPage(tenantSlug, pageSlug, session.user.id);

  if (!result) {
    notFound();
  }

  const { membership, page } = result;

  if (!hasPermission(membership.role, "pages:manage")) {
    redirect(`/dashboard/${tenantSlug}/pages`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/dashboard/${tenantSlug}/pages`} className="hover:underline">
          Pages
        </Link>
        <span>/</span>
        <span>{page.title}</span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Modifier la page</h1>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <EditPageForm
          slug={tenantSlug}
          pageId={page.id}
          page={{
            title: page.title,
            status: page.status,
            isHomepage: page.isHomepage,
            metaTitle: page.metaTitle ?? "",
            metaDescription: page.metaDescription ?? "",
          }}
        />
      </div>

      <div className="rounded-lg border border-destructive/20 bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium text-destructive">Supprimer la page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette action est irréversible.
        </p>
        <form action={deletePage.bind(null, tenantSlug, page.id)} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </button>
        </form>
      </div>
    </div>
  );
}
