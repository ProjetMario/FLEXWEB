import { requireAdmin } from "@/lib/prospection/auth";

export default async function CampaignsPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Campagnes</h1>
      <p className="text-sm text-muted-foreground">Gestion des campagnes de prospection SMS. Disponible dans la phase 5.</p>
    </div>
  );
}
