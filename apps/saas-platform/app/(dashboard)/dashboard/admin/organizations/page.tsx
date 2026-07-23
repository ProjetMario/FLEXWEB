import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { CreateOrganizationForm } from "@/components/forms/create-organization-form";

async function getMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, role: "SUPER_ADMIN" },
    include: { organization: true },
  });
}

export default async function AdminOrganizationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await getMembership(session.user.id);
  if (!membership || !hasPermission(membership.role, "organizations:create")) {
    redirect("/dashboard");
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Créer une organisation</h2>
        <div className="mt-4">
          <CreateOrganizationForm />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-medium">Liste des organisations</h2>
        <ul className="mt-4 divide-y">
          {organizations.map((org) => (
            <li key={org.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{org.name}</p>
                <p className="text-sm text-muted-foreground">
                  {org.slug} · {org.businessType} · {org.status.toLowerCase()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
