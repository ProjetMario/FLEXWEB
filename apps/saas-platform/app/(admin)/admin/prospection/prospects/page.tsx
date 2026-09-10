import Link from "next/link";
import { requireAdmin } from "@/lib/prospection/auth";
import {
  getProspects,
  getProspectFilterOptions,
} from "@/lib/prospection/prospect-queries";
import { ProspectStatusBadge } from "@/components/prospection/ProspectStatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, ChevronLeft, ChevronRight, Phone } from "lucide-react";
import type { ProspectionStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/prospection/status";
import { cn } from "@/lib/utils";
import { WEBSITE_LABELS } from "@/lib/prospection/crm-core";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const filters = {
    query: params.q,
    department: params.department,
    qualification: params.qualification,
    channel: params.channel,
    stopped: params.stopped,
    statuses: params.statuses?.split(","),
    status: params.status as ProspectionStatus | undefined,
    city: params.city,
    businessType: params.businessType,
    page: params.page ? Number(params.page) : 1,
    pageSize: params.pageSize ? Number(params.pageSize) : 25,
    sortBy:
      (params.sortBy as
        | "companyName"
        | "lastInteractionAt"
        | "nextFollowUpAt"
        | "createdAt"
        | "estimatedValue") || "lastInteractionAt",
    sortOrder: (params.sortOrder as "asc" | "desc") || "desc",
  };

  const [{ prospects, total, page, pageCount }, { cities, businessTypes }] =
    await Promise.all([getProspects(filters), getProspectFilterOptions()]);

  function buildLink(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...next })) {
      if (value) sp.set(key, value);
    }
    return `?${sp.toString()}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospects</h1>
          <p className="text-sm text-muted-foreground">
            {total} prospect(s) au total
          </p>
        </div>
        <Link
          href="/admin/prospection/prospects/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Link>
        <Link
          href="/admin/prospection/import-export"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Importer / exporter
        </Link>
      </div>

      <form className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Label htmlFor="q" className="sr-only">
            Recherche
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="q"
              name="q"
              defaultValue={filters.query}
              placeholder="Entreprise, contact, téléphone, ville..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <select
            name="department"
            defaultValue={params.department}
            aria-label="Département"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Tous les départements</option>
            {["01", "07", "26", "38", "42", "69", "73", "74"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            name="qualification"
            defaultValue={params.qualification}
            aria-label="Qualification"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Toutes les qualifications</option>
            {Object.entries(WEBSITE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            name="channel"
            defaultValue={params.channel}
            aria-label="Coordonnées disponibles"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Toutes les coordonnées</option>
            <option value="SMS">Avec mobile</option>
            <option value="EMAIL">Avec courriel</option>
          </select>
          <select
            name="stopped"
            defaultValue={params.stopped}
            aria-label="Opposition"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Avec et sans opposition</option>
            <option value="yes">Ne plus contacter</option>
            <option value="no">Sans opposition</option>
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="city"
            defaultValue={filters.city}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="businessType"
            defaultValue={filters.businessType}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Toutes les activités</option>
            {businessTypes.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            name="sortBy"
            defaultValue={filters.sortBy}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="lastInteractionAt">Dernier contact</option>
            <option value="nextFollowUpAt">Prochaine relance</option>
            <option value="companyName">Entreprise</option>
            <option value="createdAt">Date d&apos;ajout</option>
            <option value="estimatedValue">Valeur estimée</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrer
          </Button>
          <Link
            href="/admin/prospection/prospects"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Réinitialiser
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Entreprise</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Téléphone</th>
              <th className="px-4 py-3 font-medium">Activité</th>
              <th className="px-4 py-3 font-medium">Ville</th>
              <th className="px-4 py-3 font-medium">Dernier contact</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Relance</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {prospects.map((prospect) => (
              <tr
                key={prospect.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/admin/prospection/prospects/${prospect.id}`}
                    className="hover:underline"
                  >
                    {prospect.companyName}
                  </Link>
                  <p className="mt-1 text-xs font-normal text-slate-500">
                    {prospect.doNotContactAt
                      ? "Ne plus contacter"
                      : WEBSITE_LABELS[prospect.websiteFinding]}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.email || prospect.contactName || "—"}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`tel:${prospect.phone}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {prospect.phone || "À rechercher"}
                  </a>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.businessType || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.city || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.lastInteractionAt
                    ? new Date(prospect.lastInteractionAt).toLocaleDateString(
                        "fr-FR",
                      )
                    : "Non contacté"}
                </td>
                <td className="px-4 py-3">
                  <ProspectStatusBadge status={prospect.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {prospect.nextFollowUpAt
                    ? new Date(prospect.nextFollowUpAt).toLocaleDateString(
                        "fr-FR",
                      )
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/prospection/prospects/${prospect.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                    )}
                  >
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {prospects.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aucun prospect trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {pageCount} · {total} résultats
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildLink({ page: String(page - 1) })}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page <= 1 && "pointer-events-none opacity-50",
              )}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Précédent
            </Link>
            <Link
              href={buildLink({ page: String(page + 1) })}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page >= pageCount && "pointer-events-none opacity-50",
              )}
            >
              Suivant
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
