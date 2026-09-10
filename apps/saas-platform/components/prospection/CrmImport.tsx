"use client";
import { useState } from "react";
import { parseCsv } from "@/lib/prospection/crm-csv";
export default function CrmImport() {
  const [rows, setRows] = useState<Record<string, string>[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [report, setReport] = useState({
      created: 0,
      duplicates: 0,
      conflicts: [] as string[],
    });
  async function select(file?: File) {
    setError("");
    setRows([]);
    setProgress(0);
    setReport({ created: 0, duplicates: 0, conflicts: [] });
    if (!file) return;
    try {
      if (file.size > 15_000_000) throw Error("Fichier limité à 15 Mo.");
      setRows(parseCsv(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV illisible.");
    }
  }
  async function run() {
    setBusy(true);
    setError("");
    const batch = crypto.randomUUID();
    let count = { created: 0, duplicates: 0, conflicts: [] as string[] };
    setReport(count);
    try {
      for (let i = 0; i < rows.length; i += 100) {
        const res = await fetch("/api/crm/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch, rows: rows.slice(i, i + 100) }),
        });
        const value = await res.json();
        if (!res.ok)
          throw Error(
            `Lot à partir de la ligne ${i + 2} : ${value.error || "import interrompu"}`,
          );
        count = {
          created: count.created + value.created,
          duplicates: count.duplicates + value.duplicates,
          conflicts: [...count.conflicts, ...value.conflicts],
        };
        setReport(count);
        setProgress(Math.min(rows.length, i + 100));
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connexion interrompue. Vous pouvez reprendre le même fichier sans recréer les doublons.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Importer un fichier CSV</h2>
      <p className="text-sm text-slate-600">
        Le CSV FLEX-WEB est reconnu directement. Les nouvelles fiches restent à
        qualifier ; l’import ne prépare ni ne valide aucun envoi.
      </p>
      <label className="block text-sm">
        Fichier CSV (10 000 lignes maximum)
        <input
          className="mt-2 block w-full rounded border p-3"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => void select(e.target.files?.[0])}
        />
      </label>
      {!!rows.length && (
        <>
          <p>{rows.length.toLocaleString("fr-FR")} fiches détectées</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["Entreprise", "Commune", "Téléphone", "Courriel"].map(
                    (h) => (
                      <th className="p-2" key={h}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr className="border-t" key={i}>
                    <td className="p-2">{r.entreprise}</td>
                    <td>{r.commune}</td>
                    <td>{r.telephone || "—"}</td>
                    <td>{r.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy || progress === rows.length}
            onClick={() => void run()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy
              ? "Import en cours…"
              : progress === rows.length
                ? "Import terminé"
                : "Importer au statut À qualifier"}
          </button>
        </>
      )}
      {(busy || progress > 0) && (
        <div role="status" className="space-y-2">
          <progress
            className="w-full"
            max={rows.length || 1}
            value={progress}
          />
          <p>
            {progress} / {rows.length} lignes traitées · {report.created}{" "}
            créations · {report.duplicates} doublons ignorés ·{" "}
            {report.conflicts.length} conflits à vérifier.
          </p>
        </div>
      )}
      {!!report.conflicts.length && (
        <p className="rounded bg-amber-50 p-3 text-sm">
          Coordonnées partagées entre plusieurs entreprises :{" "}
          {report.conflicts.slice(0, 20).join(", ")}. Ces fiches n’ont pas été
          importées.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error} Les lots déjà enregistrés sont conservés. Réimporter le même
          fichier ignore les fiches existantes.
        </p>
      )}
    </section>
  );
}
