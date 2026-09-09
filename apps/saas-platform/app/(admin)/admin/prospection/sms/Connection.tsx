"use client";
import { useState, useTransition } from "react";
import { connectionAction } from "./actions";
export default function Connection({ configured }: { configured: boolean }) {
  const [keys, setKeys] = useState({
    webhookKey: "",
    dispatchKey: "",
    error: "",
  });
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {!configured && !keys.webhookKey && (
        <button
          className="rounded-lg border px-4 py-2"
          disabled={pending}
          onClick={() => start(async () => setKeys(await connectionAction()))}
        >
          {pending ? "Préparation…" : "Préparer les clés de connexion"}
        </button>
      )}
      {keys.error && (
        <p role="alert" className="text-red-700">
          {keys.error}
        </p>
      )}
      {keys.webhookKey && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p>
            Copiez ces deux clés dans les connexions ci-dessous avant de quitter
            cette page. Elles ne seront plus affichées.
          </p>
          <label className="block">
            Clé pour le webhook Onoff
            <input
              id="sms-webhook-key"
              readOnly
              type="password"
              autoComplete="off"
              className="mt-1 w-full rounded border bg-white p-2"
              value={keys.webhookKey}
            />
          </label>
          <label className="block">
            Clé pour Zapier
            <input
              id="sms-dispatch-key"
              readOnly
              type="password"
              autoComplete="off"
              className="mt-1 w-full rounded border bg-white p-2"
              value={keys.dispatchKey}
            />
          </label>
        </div>
      )}
    </div>
  );
}
