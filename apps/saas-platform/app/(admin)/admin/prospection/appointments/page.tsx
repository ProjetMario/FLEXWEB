import { requireAdmin } from "@/lib/prospection/auth";

export default async function AppointmentsPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Rendez-vous</h1>
      <p className="text-sm text-muted-foreground">Liste des rendez-vous prospection. Disponible dans la phase 4.</p>
    </div>
  );
}
