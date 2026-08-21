import { requireAdmin } from "@/lib/prospection/auth";

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <p className="text-sm text-muted-foreground">Paramètres du module de prospection.</p>
    </div>
  );
}
