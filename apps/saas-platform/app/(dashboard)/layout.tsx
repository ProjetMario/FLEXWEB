import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
async function getUserOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });
}

type MembershipWithOrg = Awaited<ReturnType<typeof getUserOrganizations>>[number];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const memberships: MembershipWithOrg[] = await getUserOrganizations(session.user.id);
  const isSuperAdmin = memberships.some((m: MembershipWithOrg) => m.role === "SUPER_ADMIN");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            FlexWeb Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 border-r bg-muted/40 lg:block">
          <nav className="flex flex-col gap-1 p-4">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Tableau de bord
            </Link>
            {isSuperAdmin && (
              <>
                <Link
                  href="/dashboard/admin/organizations"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Organisations
                </Link>
                <Link
                  href="/dashboard/admin/templates"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Templates
                </Link>
              </>
            )}
            {memberships.map((membership: MembershipWithOrg) => (
              <Link
                key={membership.organizationId}
                href={`/dashboard/${membership.organization.slug}`}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {membership.organization.name}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
