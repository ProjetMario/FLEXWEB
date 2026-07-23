import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import Link from "next/link";

async function getMembership(userId: string, slug: string) {
  return prisma.membership.findFirst({
    where: {
      userId,
      organization: { slug },
    },
    include: { organization: true },
  });
}

type MembershipWithOrg = NonNullable<Awaited<ReturnType<typeof getMembership>>>;

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { tenantSlug } = await params;
  const membership: MembershipWithOrg | null = await getMembership(
    session.user.id,
    tenantSlug
  );

  if (!membership) notFound();

  const canManageWebsite = hasPermission(membership.role, "websites:manage");
  const canManageContent = hasPermission(membership.role, "content:manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{membership.organization.name}</h1>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">
          {membership.role.toLowerCase()}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canManageWebsite && (
          <DashboardCard
            title="Site web"
            description="Prévisualisez et publiez votre site."
            href={`/dashboard/${tenantSlug}/site`}
          />
        )}
        {canManageContent && (
          <>
            <DashboardCard
              title="Pages"
              description="Gérez les pages et les blocs."
              href={`/dashboard/${tenantSlug}/pages`}
            />
            <DashboardCard
              title="Médias"
              description="Images, documents et fichiers."
              href={`/dashboard/${tenantSlug}/media`}
            />
          </>
        )}
        <DashboardCard
          title="Formulaires"
          description="Demandes et messages reçus."
          href={`/dashboard/${tenantSlug}/forms`}
        />
        <DashboardCard
          title="Paramètres"
          description="Informations et équipe."
          href={`/dashboard/${tenantSlug}/settings`}
        />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card p-6 shadow-sm transition-colors hover:bg-muted"
    >
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
