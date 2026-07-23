import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getUserOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });
}

type MembershipWithOrg = Awaited<ReturnType<typeof getUserOrganizations>>[number];

export default async function DashboardHomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const memberships: MembershipWithOrg[] = await getUserOrganizations(session.user.id);
  const isSuperAdmin = memberships.some((m: MembershipWithOrg) => m.role === "SUPER_ADMIN");

  if (memberships.length === 1) {
    redirect(`/dashboard/${memberships[0].organization.slug}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>

      {isSuperAdmin && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">Super administrateur</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les organisations, templates, domaines et abonnements.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/dashboard/admin/organizations"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Organisations
            </Link>
            <Link
              href="/dashboard/admin/templates"
              className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              Templates
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Vos espaces</h2>
        <ul className="mt-4 space-y-2">
          {memberships.map((m: MembershipWithOrg) => (
            <li key={m.organizationId}>
              <Link
                href={`/dashboard/${m.organization.slug}`}
                className="flex items-center justify-between rounded-md border p-4 hover:bg-muted"
              >
                <span className="font-medium">{m.organization.name}</span>
                <span className="text-sm text-muted-foreground capitalize">{m.role.toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
