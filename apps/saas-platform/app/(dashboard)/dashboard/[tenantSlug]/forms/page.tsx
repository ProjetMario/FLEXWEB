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
          forms: {
            include: {
              _count: { select: { submissions: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  return membership;
}

export default async function OrganizationFormsPage({
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

  const canReadForms = hasPermission(membership.role, "forms:read");
  if (!canReadForms) {
    redirect(`/dashboard/${tenantSlug}`);
  }

  const { forms } = membership.organization;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Formulaires</h1>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Demandes reçues</h2>
        {forms.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun formulaire configuré.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {forms.map((form) => (
              <li
                key={form.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium">{form.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {form._count.submissions} message
                    {form._count.submissions > 1 ? "s" : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    form.isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {form.isActive ? "Actif" : "Inactif"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
