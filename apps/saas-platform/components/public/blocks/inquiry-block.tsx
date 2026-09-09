"use client";
import { useRef, useState } from "react";
export function InquiryBlock({ services }: { services: string[] }) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const identity = useRef<string | null>(null);
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h2 className="text-2xl font-semibold">Demander un devis</h2>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const form = e.currentTarget;
          try {
            identity.current ||= crypto.randomUUID();
            const data = Object.fromEntries(new FormData(form));
            const response = await fetch("/api/inquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...data, requestKey: identity.current }),
              signal: AbortSignal.timeout(15000),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "Envoi impossible");
            setNotice("Votre demande a bien été reçue.");
            form.reset();
            identity.current = null;
          } catch (e) {
            setError(e instanceof Error ? e.message : "Envoi impossible");
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["name", "Votre nom", "text"],
          ["email", "Votre e-mail", "email"],
          ["phone", "Téléphone", "tel"],
          ["city", "Ville du projet", "text"],
        ].map(([name, label, type]) => (
          <label className="block text-sm" key={name}>
            {label}
            <input
              name={name}
              type={type}
              required
              maxLength={name === "email" ? 254 : 120}
              className="mt-1 block w-full rounded-lg border bg-background p-3"
            />
          </label>
        ))}
        <label className="block text-sm">
          Prestation
          <select
            name="service"
            required
            className="mt-1 block w-full rounded-lg border bg-background p-3"
          >
            {services.map((s) => (
              <option key={s}>{s}</option>
            ))}
            <option>Autre demande</option>
          </select>
        </label>
        <label className="block text-sm">
          Votre besoin
          <textarea
            name="message"
            required
            minLength={15}
            maxLength={3000}
            rows={4}
            className="mt-1 block w-full rounded-lg border bg-background p-3"
          />
        </label>
        <div hidden>
          <input name="websiteTrap" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="privacy" value="yes" required />
          J’accepte l’utilisation de ces informations pour répondre à ma
          demande.
        </label>
        <p className="text-xs text-muted-foreground">
          Les informations sont transmises à cette entreprise pour traiter votre
          demande. Vous pouvez la contacter pour exercer vos droits sur vos
          données.
        </p>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="rounded-lg bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Envoyer ma demande"}
        </button>
      </form>
    </section>
  );
}
