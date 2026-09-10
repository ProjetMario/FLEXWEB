import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/prospection/auth";
import { getProspectById } from "@/lib/prospection/prospect-detail";
import { ProspectStatusBadge } from "@/components/prospection/ProspectStatusBadge";
import { ProspectQuickActions } from "@/components/prospection/ProspectQuickActions";
import { ProspectTimeline } from "@/components/prospection/ProspectTimeline";
import CrmPanel from "@/components/prospection/CrmPanel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Globe,
  ExternalLink,
  Building2,
} from "lucide-react";

export default async function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const prospect = await getProspectById(id);
  const query = await searchParams;

  if (!prospect) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {query.error && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-800">
          {query.error}
        </p>
      )}
      {query.saved && (
        <p role="status" className="rounded bg-green-50 p-4 text-green-800">
          {query.saved}
        </p>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <Link
            href="/admin/prospection/prospects"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour aux prospects
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {prospect.companyName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <ProspectStatusBadge status={prospect.status} />
            {prospect.businessType && (
              <span className="text-sm text-muted-foreground">
                {prospect.businessType}
              </span>
            )}
          </div>
        </div>
        <ProspectQuickActions prospect={prospect} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Informations
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> Contact
                </dt>
                <dd>{prospect.contactName || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> Téléphone
                </dt>
                <dd>
                  <a href={`tel:${prospect.phone}`} className="hover:underline">
                    {prospect.phone}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> Email
                </dt>
                <dd>
                  {prospect.email ? (
                    <a
                      href={`mailto:${prospect.email}`}
                      className="hover:underline"
                    >
                      {prospect.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> Adresse
                </dt>
                <dd>
                  {[prospect.city, prospect.department, prospect.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" /> Site internet
                </dt>
                <dd>
                  {prospect.website ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      Voir <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Google Business</dt>
                <dd>
                  {prospect.googleBusinessUrl ? (
                    <a
                      href={prospect.googleBusinessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      Voir <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {prospect.googleRating && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Note Google</dt>
                  <dd>
                    {prospect.googleRating} / 5 (
                    {prospect.googleReviewCount ?? 0} avis)
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Valeur
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Valeur potentielle</dt>
                <dd>
                  {prospect.estimatedValue
                    ? `${prospect.estimatedValue.toLocaleString("fr-FR")} €`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Mise en service</dt>
                <dd>
                  {prospect.setupFee
                    ? `${prospect.setupFee.toLocaleString("fr-FR")} €`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Prix mensuel</dt>
                <dd>
                  {prospect.monthlyPrice
                    ? `${prospect.monthlyPrice.toLocaleString("fr-FR")} €/mois`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Achat définitif</dt>
                <dd>
                  {prospect.oneTimePrice
                    ? `${prospect.oneTimePrice.toLocaleString("fr-FR")} €`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <CrmPanel prospect={prospect} />
          <section className="rounded-xl border bg-white p-5 space-y-3">
            <h2 className="font-semibold">Messages et séquences</h2>
            {prospect.smsContact && (
              <Link
                className="block text-sm text-blue-700 underline"
                href={`/admin/prospection/sms?id=${prospect.smsContact.id}`}
              >
                Ouvrir le SMS et ses réponses
              </Link>
            )}
            {prospect.emailLeads.map((l) => (
              <Link
                className="block text-sm text-blue-700 underline"
                key={l.id}
                href={`/admin/prospection/outreach/${l.id}`}
              >
                Ouvrir la séquence e-mail ·{" "}
                {l.messages.filter((m) => m.status === "SENT").length} /{" "}
                {l.messages.length} envoyés
              </Link>
            ))}
            {!prospect.smsContact && !prospect.emailLeads.length && (
              <p className="text-sm text-slate-500">
                Aucun message préparé pour cette entreprise.
              </p>
            )}
          </section>
          <ProspectTimeline
            prospect={prospect}
            interactions={prospect.interactions}
            followUps={prospect.followUps}
            notes={prospect.notes}
          />
        </div>
      </div>
    </div>
  );
}
