/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import type { Snapshot } from "@/lib/studio/core";
const backend = "https://flexweb-gestion.netlify.app";
export default function SiteView({
  data,
  siteId,
  basePath = "",
  pageSlug = "accueil",
  preview = false,
  onPage,
}: {
  data: Snapshot;
  siteId: string;
  basePath?: string;
  pageSlug?: string;
  preview?: boolean;
  onPage?: (slug: string) => void;
}) {
  const b = data.brief,
    content = data.content;
  const [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  const pages = content.pages.filter(
    (p) =>
      p.slug !== "realisations" || p.sections.some((s) => s.body || s.imageId),
  );
  const page = pages.find((p) => p.slug === pageSlug);
  const href = (slug: string) =>
    basePath + (slug === "accueil" ? "/" : `/${slug}`);
  const image = (id: string) =>
    `${preview ? "" : backend}/api/studio/media/${id}`;
  const bg =
    b.theme === "nature"
      ? "#f4f5ed"
      : b.theme === "atelier"
        ? "#faf7f2"
        : "#ffffff";
  return (
    <div
      className="min-h-[600px] text-slate-900"
      style={{
        background: bg,
        fontFamily:
          b.theme === "atelier" ? "Georgia, serif" : "Arial, sans-serif",
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-black/10 px-6 py-6 md:px-12">
        <a
          href={href("accueil")}
          onClick={
            preview
              ? (e) => {
                  e.preventDefault();
                  onPage?.("accueil");
                }
              : undefined
          }
          className="text-xl font-bold tracking-tight"
        >
          {b.logoId ? (
            <img
              src={image(b.logoId)}
              alt={b.company}
              className="h-12 max-w-40 object-contain"
            />
          ) : (
            b.company
          )}
        </a>
        <nav
          className="flex flex-wrap gap-5 text-sm"
          aria-label="Navigation du site"
        >
          {pages.map((p) => (
            <a
              key={p.slug}
              href={href(p.slug)}
              onClick={
                preview
                  ? (e) => {
                      e.preventDefault();
                      onPage?.(p.slug);
                    }
                  : undefined
              }
              className={
                p.slug === pageSlug
                  ? "font-bold underline underline-offset-8"
                  : ""
              }
            >
              {p.title}
            </a>
          ))}
        </nav>
      </header>
      {pageSlug === "mentions-legales" ? (
        <main className="mx-auto max-w-3xl px-6 py-16 space-y-5">
          <h1 className="text-4xl">Mentions légales et confidentialité</h1>
          <p>
            {b.legalName} — {b.legalForm}
            <br />
            {b.address}
            <br />
            SIREN : {b.siren}
            <br />
            Responsable de publication : {b.contactName}
            <br />
            {b.email} · {b.phone}
          </p>
          <p>
            Hébergement technique : Netlify, Inc., 512 2nd Street, Suite 200,
            San Francisco, CA 94107, États-Unis. Service de création : FLEX-WEB.
          </p>
          <p>
            Les informations du formulaire servent à traiter votre demande
            auprès de {b.legalName}. Elles sont accessibles à cette entreprise
            dans son espace FLEX-WEB. Pour exercer vos droits ou demander leur
            suppression, écrivez à {b.email}. Ce site n’utilise pas de cookies
            publicitaires ou de mesure d’audience.
          </p>
        </main>
      ) : page ? (
        <main>
          {page.sections
            .filter((s) => s.title || s.body || s.imageId)
            .map((s, i) => (
              <section
                key={i}
                className={`mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-16 ${s.imageId ? "grid items-center gap-10 md:grid-cols-2" : ""}`}
              >
                <div>
                  {i === 0 && pageSlug === "accueil" && (
                    <p
                      className="mb-5 text-xs font-bold uppercase tracking-[.2em]"
                      style={{ color: b.color }}
                    >
                      {b.activity} · {b.city}
                    </p>
                  )}
                  {i === 0 ? (
                    <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
                      {pageSlug === "accueil" ? content.tagline : s.title}
                    </h1>
                  ) : (
                    <h2 className="text-3xl font-semibold">{s.title}</h2>
                  )}
                  <p className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-slate-600">
                    {s.body}
                  </p>
                  {i === 0 && pageSlug !== "contact" && (
                    <a
                      className="mt-8 inline-block rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white"
                      href={href("contact")}
                      onClick={
                        preview
                          ? (e) => {
                              e.preventDefault();
                              onPage?.("contact");
                            }
                          : undefined
                      }
                    >
                      Parlons de votre projet ↗
                    </a>
                  )}
                </div>
                {s.imageId && (
                  <img
                    src={image(s.imageId)}
                    alt={s.title || b.company}
                    className="aspect-[4/3] w-full rounded-2xl object-cover"
                  />
                )}
              </section>
            ))}
          {pageSlug === "contact" && (
            <form
              className="mx-auto max-w-2xl space-y-4 px-6 pb-16"
              onSubmit={async (e) => {
                e.preventDefault();
                if (preview) {
                  setResult("Le formulaire sera actif après publication.");
                  return;
                }
                setBusy(true);
                try {
                  const f = new FormData(e.currentTarget);
                  const r = await fetch(`${backend}/api/studio/inquiry`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      siteId,
                      name: f.get("name"),
                      email: f.get("email"),
                      message: f.get("message"),
                      companyWebsite: f.get("companyWebsite"),
                      accepted: f.get("accepted") === "on",
                    }),
                  });
                  const v = await r.json();
                  setResult(
                    r.ok
                      ? "Votre demande a été enregistrée. L’entreprise vous répondra directement."
                      : v.error,
                  );
                } catch {
                  setResult(
                    "Le formulaire est indisponible. Contactez directement l’entreprise.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2 className="text-2xl">Écrivez-nous</h2>
              <label className="block">
                Votre nom
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  className="mt-1 block w-full rounded-lg border bg-white p-3"
                />
              </label>
              <label className="block">
                Votre e-mail
                <input
                  type="email"
                  name="email"
                  required
                  className="mt-1 block w-full rounded-lg border bg-white p-3"
                />
              </label>
              <label className="block">
                Votre demande
                <textarea
                  name="message"
                  minLength={10}
                  maxLength={4000}
                  required
                  rows={5}
                  className="mt-1 block w-full rounded-lg border bg-white p-3"
                />
              </label>
              <label className="hidden" aria-hidden="true">
                Votre site
                <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
              </label>
              <label className="flex gap-2 text-sm">
                <input name="accepted" type="checkbox" required />
                J’accepte que mes coordonnées soient utilisées pour répondre à
                cette demande.
              </label>
              <button
                disabled={busy}
                className="rounded-full bg-slate-900 px-7 py-3 text-white"
              >
                {busy ? "Enregistrement…" : "Envoyer ma demande"}
              </button>
              <p role="status">{result}</p>
            </form>
          )}
        </main>
      ) : (
        <main className="p-16">Cette page n’est pas disponible.</main>
      )}
      <footer className="border-t border-black/10 px-6 py-8 text-sm text-slate-600 md:px-12">
        <div className="flex flex-wrap justify-between gap-4">
          <p>
            {b.company} · {b.city}
            <br />
            {b.phone} · {b.email}
          </p>
          <a
            href={href("mentions-legales")}
            onClick={
              preview
                ? (e) => {
                    e.preventDefault();
                    onPage?.("mentions-legales");
                  }
                : undefined
            }
          >
            Mentions légales et confidentialité
          </a>
        </div>
        <p className="mt-6 text-xs">Site créé avec FLEX-WEB</p>
      </footer>
    </div>
  );
}
