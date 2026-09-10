import Link from "next/link";
import { requireAdmin } from "@/lib/prospection/auth";
import CrmImport from "@/components/prospection/CrmImport";
export default async function ImportPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Import et export du CRM</h1>
        <p className="mt-2 text-slate-600">
          Détection des doublons par SIREN, source, téléphone et courriel. Les
          coordonnées existantes et les oppositions sont conservées.
        </p>
      </header>
      <CrmImport />
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Exporter les fiches</h2>
        <p className="my-3 text-sm text-slate-600">
          CSV avec les coordonnées, la qualification, le statut commercial et
          les oppositions. Jusqu’à 10 000 fiches par export.
        </p>
        <a download href="/api/crm/export" className="text-blue-700 underline">
          Télécharger le CSV
        </a>
        <Link
          href="/admin/prospection/prospects"
          className="ml-6 text-blue-700 underline"
        >
          Ouvrir les prospects
        </Link>
      </section>
    </div>
  );
}
