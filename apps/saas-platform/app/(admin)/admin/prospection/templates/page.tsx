import { requireAdmin } from "@/lib/prospection/auth";

export default async function TemplatesPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Templates SMS</h1>
      <p className="text-sm text-muted-foreground">Modèles de SMS avec variables. Disponible dans la phase 3.</p>
    </div>
  );
}
