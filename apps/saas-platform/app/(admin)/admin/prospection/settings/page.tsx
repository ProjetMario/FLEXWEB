import Link from "next/link";
import { requireAdmin } from "@/lib/prospection/auth";
export default async function Settings() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Paramètres de prospection</h1>
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Comptes et envois</h2>
        <Link
          className="block text-blue-700 underline"
          href="/admin/prospection/sms"
        >
          Raccorder Onoff et Zapier, vérifier les SMS
        </Link>
        <Link
          className="block text-blue-700 underline"
          href="/admin/prospection/inbox"
        >
          Tester IONOS, synchroniser les réponses et gérer les campagnes
        </Link>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">Organisation commerciale</h2>
        <Link
          className="block text-blue-700 underline"
          href="/admin/prospection/templates"
        >
          Modèles de messages
        </Link>
        <Link
          className="block text-blue-700 underline"
          href="/admin/prospection/import-export"
        >
          Importer et exporter les fiches
        </Link>
        <Link
          className="block text-blue-700 underline"
          href="/admin/prospection/prospects?stopped=yes"
        >
          Liste des entreprises à ne plus contacter
        </Link>
      </section>
    </div>
  );
}
