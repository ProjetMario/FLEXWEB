"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { STATUS_LABELS } from "@/lib/prospection/status";
import { cn } from "@/lib/utils";
import type { SmsCampaign } from "@prisma/client";

interface Props {
  action: (formData: FormData) => Promise<{ ok: boolean; errors?: Record<string, string[]> }>;
  campaigns: Pick<SmsCampaign, "id" | "name">[];
}

export function ProspectForm({ action, campaigns }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => action(formData),
    { ok: false, errors: {} }
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/prospection/prospects" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajouter un prospect</h1>
        <p className="text-sm text-muted-foreground">Renseigne les informations de l&apos;entreprise contactée.</p>
      </div>

      <form action={formAction} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informations générales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="companyName" label="Nom de l&apos;entreprise *" errors={state.errors?.companyName}>
              <Input name="companyName" required />
            </Field>
            <Field name="contactName" label="Nom du contact" errors={state.errors?.contactName}>
              <Input name="contactName" />
            </Field>
            <Field name="phone" label="Téléphone *" errors={state.errors?.phone}>
              <Input name="phone" type="tel" required />
            </Field>
            <Field name="email" label="Email" errors={state.errors?.email}>
              <Input name="email" type="email" />
            </Field>
            <Field name="website" label="Site internet" errors={state.errors?.website}>
              <Input name="website" type="url" placeholder="https://..." />
            </Field>
            <Field name="googleBusinessUrl" label="URL Google Business" errors={state.errors?.googleBusinessUrl}>
              <Input name="googleBusinessUrl" type="url" />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Localisation & activité</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="businessType" label="Activité" errors={state.errors?.businessType}>
              <Input name="businessType" placeholder="Ex. Restaurant" />
            </Field>
            <Field name="category" label="Catégorie" errors={state.errors?.category}>
              <Input name="category" />
            </Field>
            <Field name="source" label="Source du prospect" errors={state.errors?.source}>
              <Input name="source" placeholder="Ex. Google Maps" />
            </Field>
            <Field name="city" label="Ville" errors={state.errors?.city}>
              <Input name="city" />
            </Field>
            <Field name="department" label="Département" errors={state.errors?.department}>
              <Input name="department" />
            </Field>
            <Field name="country" label="Pays" errors={state.errors?.country}>
              <Input name="country" defaultValue="France" />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Google Business</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="googleReviewCount" label="Nombre d&apos;avis Google" errors={state.errors?.googleReviewCount}>
              <Input name="googleReviewCount" type="number" min={0} />
            </Field>
            <Field name="googleRating" label="Note Google" errors={state.errors?.googleRating}>
              <Input name="googleRating" type="number" min={0} max={5} step={0.1} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Suivi & offre</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Statut initial</Label>
              <select id="status" name="status" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignId">Campagne</Label>
              <select id="campaignId" name="campaignId" className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Aucune campagne</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field name="estimatedValue" label="Valeur potentielle estimée (€)" errors={state.errors?.estimatedValue}>
              <Input name="estimatedValue" type="number" min={0} />
            </Field>
            <Field name="setupFee" label="Frais de mise en service (€)" errors={state.errors?.setupFee}>
              <Input name="setupFee" type="number" min={0} />
            </Field>
            <Field name="monthlyPrice" label="Prix mensuel (€)" errors={state.errors?.monthlyPrice}>
              <Input name="monthlyPrice" type="number" min={0} />
            </Field>
            <Field name="oneTimePrice" label="Prix achat définitif (€)" errors={state.errors?.oneTimePrice}>
              <Input name="oneTimePrice" type="number" min={0} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Commentaire interne</Label>
            <textarea
              id="internalNotes"
              name="internalNotes"
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin/prospection/prospects" className={cn(buttonVariants({ variant: "outline" }))}>
            Annuler
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : "Enregistrer le prospect"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  errors,
  children,
}: {
  name: string;
  label: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}
