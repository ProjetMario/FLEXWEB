import { requireAdmin } from "@/lib/prospection/auth";
import { AdminSidebar } from "@/components/prospection/AdminSidebar";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default async function ProspectionAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AdminSidebar />

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white/80 px-6 backdrop-blur dark:bg-slate-950/80 dark:border-slate-800">
          <div>
            <h1 className="text-lg font-semibold">Bonjour Flex-Web 👋</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Voici un aperçu de la prospection aujourd&apos;hui.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">{user.email}</span>
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
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
