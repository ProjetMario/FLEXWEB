import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { InviteMemberForm } from "@/components/forms/invite-member-form";
import { removeMember } from "@/lib/actions/membership";

async function getOrganization(slug: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organization: { slug },
    },
    include: {
      organization: {
        include: {
          memberships: {
            include: { user: true },
            orderBy: { createdAt: "desc" },
          },
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return membership;
}

export default async function OrganizationSettingsPage({
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

  const { organization } = membership;
  const canInvite = hasPermission(membership.role, "users:invite");
  const canManageMembers = hasPermission(membership.role, "users:manage");
  const subscription = organization.subscriptions[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">Informations</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nom</dt>
              <dd className="font-medium">{organization.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-medium">{organization.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Type d'activité</dt>
              <dd className="font-medium">{organization.businessType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Statut</dt>
              <dd className="font-medium capitalize">{organization.status.toLowerCase()}</dd>
            </div>
            {subscription && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Abonnement</dt>
                <dd className="font-medium">
                  {subscription.plan} · {subscription.status.toLowerCase()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {canInvite && (
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-medium">Inviter un membre</h2>
            <div className="mt-4">
              <InviteMemberForm slug={tenantSlug} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Équipe</h2>
        <ul className="mt-4 divide-y">
          {organization.memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{m.user.email}</p>
                <p className="text-sm text-muted-foreground">
                  {m.user.name || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                  {m.role.toLowerCase()}
                </span>
                {canManageMembers && m.userId !== session.user.id && (
                  <form action={removeMember.bind(null, tenantSlug, m.id)}>
                    <button
                      type="submit"
                      className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      Supprimer
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
