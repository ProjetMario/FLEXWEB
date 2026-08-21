import { requireAdmin } from "@/lib/prospection/auth";

export default async function FollowUpsPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Relances</h1>
      <p className="text-sm text-muted-foreground">Suivi des relances à effectuer. Disponible dans la phase 4.</p>
    </div>
  );
}
