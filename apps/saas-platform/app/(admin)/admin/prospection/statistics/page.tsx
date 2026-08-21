import { requireAdmin } from "@/lib/prospection/auth";

export default async function StatisticsPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Statistiques</h1>
      <p className="text-sm text-muted-foreground">Statistiques détaillées par campagne. Disponible dans la phase 6.</p>
    </div>
  );
}
