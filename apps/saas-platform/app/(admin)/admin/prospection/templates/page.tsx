import { requireAdmin } from "@/lib/prospection/auth";
import { prisma } from "@/lib/prisma";
import { defaultSms } from "@/lib/sms/core";
import { saveTemplate } from "./actions";
const field = "mt-1 block w-full rounded-lg border bg-white p-2 text-sm";
export default async function Templates({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const [rows, q] = await Promise.all([
    prisma.crmMessageTemplate.findMany({ orderBy: { name: "asc" } }),
    searchParams,
  ]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Modèles SMS et e-mail</h1>
      <p className="text-slate-600">
        Variables : {"{{entreprise}}"}, {"{{ville}}"} et {"{{activite}}"}.
        Choisissez un modèle dans la fiche prospect avant de préparer son
        premier message. Les messages déjà créés ne sont pas modifiés.
      </p>
      {q.error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {q.error}
        </p>
      )}
      {q.saved && (
        <p role="status" className="rounded bg-green-50 p-3 text-green-800">
          Modèle enregistré.
        </p>
      )}
      {[null, ...rows].map((r, i) => (
        <form
          key={r?.id || "new"}
          action={saveTemplate}
          className="space-y-4 rounded-xl border bg-white p-5"
        >
          <h2 className="font-semibold">
            {r ? "Modifier " + r.name : "Créer un modèle"}
          </h2>
          {r && <input type="hidden" name="id" value={r.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Nom
              <input
                required
                name="name"
                className={field}
                defaultValue={r?.name || ""}
              />
            </label>
            <label className="text-sm">
              Canal
              <select
                name="channel"
                className={field}
                defaultValue={r?.channel || "SMS"}
              >
                <option value="SMS">SMS</option>
                <option value="EMAIL">E-mail</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Objet (e-mail)
            <input
              name="subject"
              className={field}
              defaultValue={r?.subject || ""}
            />
          </label>
          <label className="block text-sm">
            Message
            <textarea
              required
              name="body"
              rows={5}
              className={field}
              defaultValue={
                r?.body || (i === 0 ? defaultSms("{{entreprise}}") : "")
              }
            />
          </label>
          <p className="text-xs text-slate-500">
            SMS : conserver FLEX-WEB, STOP et le lien d’information. E-mail : la
            signature et le lien de désinscription sont ajoutés à l’envoi.
          </p>
          <button className="rounded-lg border px-4 py-2 text-sm">
            Enregistrer le modèle
          </button>
        </form>
      ))}
    </div>
  );
}
