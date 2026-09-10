/* eslint-disable @next/next/no-img-element */
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getUser,
  login,
  signup,
  logout,
  handleAuthCallback,
  requestPasswordRecovery,
  updateUser,
} from "@netlify/identity";
import SiteView from "./SiteView";
import {
  StudioInspiration,
  StudioJourney,
  StudioProgress,
  PublicationOffer,
} from "./StudioDesign";
import styles from "./StudioDesign.module.css";
import type { Brief, Draft } from "@/lib/studio/core";
const input =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none";
const button =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40 hover:bg-slate-50";
const primary =
  "rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 disabled:opacity-40 hover:bg-blue-800";
const empty: Brief = {
  company: "",
  activity: "",
  city: "",
  description: "",
  services: "",
  about: "",
  phone: "",
  email: "",
  area: "",
  color: "#245947",
  theme: "atelier",
  legalName: "",
  address: "",
  siren: "",
  legalForm: "",
  contactName: "",
  logoId: "",
};
type Site = {
  id: string;
  slug: string;
  brief: Brief;
  draft: Draft;
  draftRevision: number;
  trialEndsAt: string;
  state: string;
  billingStatus: string;
  paidThrough: string | null;
  pastDueAt: string | null;
  cancelAtPeriodEnd: boolean;
  publishedAt: string | null;
  hasPrevious: boolean;
  domain: string | null;
  domainToken: string | null;
  domainState: string;
  domainError: string | null;
  assets: { id: string; bytes: number }[];
  jobs: { id: string; state: string; error: string | null }[];
  inquiries: {
    id: string;
    name: string;
    email: string;
    message: string;
    createdAt: string;
  }[];
  quotaUsed: number;
  quotaLimit: number;
  publicUrl: string;
};
type Status = {
  email: string;
  allowed: boolean;
  site: Site | null;
  aiEnabled: boolean;
  paymentsEnabled: boolean;
};
const date = (s: string) => new Date(s).toLocaleDateString("fr-FR");
export default function Studio() {
  const [status, setStatus] = useState<Status | null>(null),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "recovery" | "reset">(
      "signup",
    ),
    [brief, setBrief] = useState<Brief>(empty),
    [draft, setDraft] = useState<Draft | null>(null),
    [tab, setTab] = useState("contenu"),
    [page, setPage] = useState("accueil"),
    [previewPage, setPreviewPage] = useState("accueil"),
    [mobile, setMobile] = useState(false),
    [instruction, setInstruction] = useState(""),
    [dirty, setDirty] = useState(false),
    [accepted, setAccepted] = useState(false),
    [domain, setDomain] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/studio/status", { cache: "no-store" });
    if (response.status === 401) {
      setStatus(null);
      return;
    }
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    setStatus(data);
    if (data.site) {
      setBrief(data.site.brief);
      setDraft(data.site.draft);
      setDomain(data.site.domain || "");
    } else setBrief((b) => ({ ...b, email: data.email }));
    setDirty(false);
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const callback = await handleAuthCallback();
        if (callback?.type === "recovery") {
          if (alive) setMode("reset");
          return;
        }
        if (await getUser()) await refresh();
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Connexion indisponible.");
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);
  const running = !!status?.site?.jobs.some(
    (j) => j.state === "PENDING" || j.state === "RUNNING",
  );
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [running, refresh]);
  async function call(action: string, payload: unknown = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/studio/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Action impossible.");
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      await refresh();
      setMessage(
        action === "generate"
          ? "Votre site est en cours de rédaction. Vous pouvez rester sur cette page."
          : action === "publish"
            ? "Votre site est en ligne."
            : action === "save"
              ? "Brouillon enregistré."
              : action === "create"
                ? "Votre espace est prêt. Vous pouvez maintenant demander la rédaction IA."
                : "Modification enregistrée.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }
  function field(
    key: keyof Brief,
    label: string,
    multiline = false,
    required = false,
  ) {
    return (
      <label key={key} className="block text-sm font-medium text-slate-700">
        {label}
        {multiline ? (
          <textarea
            rows={key === "description" ? 4 : 3}
            className={input}
            required={required}
            maxLength={
              key === "description" || key === "services" || key === "about"
                ? 2000
                : 400
            }
            value={brief[key]}
            onChange={(e) => {
              setBrief({ ...brief, [key]: e.target.value });
              setDirty(true);
            }}
          />
        ) : (
          <input
            className={input}
            required={required}
            type={
              key === "email" ? "email" : key === "color" ? "color" : "text"
            }
            value={brief[key]}
            onChange={(e) => {
              setBrief({ ...brief, [key]: e.target.value });
              setDirty(true);
            }}
          />
        )}
      </label>
    );
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/studio/upload", {
        method: "POST",
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      const latest = await fetch("/api/studio/status").then((r) => r.json());
      setStatus(latest);
      setMessage(
        "Photo ajoutée. Choisissez-la dans une section ou comme logo.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo indisponible.");
    } finally {
      setBusy(false);
    }
  }
  const s = status?.site;
  const isPaid =
    s?.billingStatus === "ACTIVE" &&
    !!s.paidThrough &&
    new Date(s.paidThrough) > new Date();
  const canEdit =
    !!s &&
    (isPaid ||
      new Date(s.trialEndsAt) > new Date() ||
      (s.billingStatus === "PAST_DUE" &&
        !!s.pastDueAt &&
        new Date().getTime() < new Date(s.pastDueAt).getTime() + 7 * 86400000));
  return (
    <div className={styles.shell + " min-h-screen"}>
      <header className="sticky top-0 z-20 border-b bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="https://flex-web.fr" className="font-bold tracking-tight">
            FLEX-WEB{" "}
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              Autonome
            </span>
          </a>
          {status ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-500 sm:block">
                {status.email}
              </span>
              <button
                className="text-sm"
                onClick={async () => {
                  await logout();
                  setStatus(null);
                  setMode("login");
                }}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <a href="https://flex-web.fr/pricing/" className="text-sm">
              Les offres
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-5 md:p-8">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900"
          >
            {message}
          </p>
        )}
        {!loaded ? (
          <p className="py-20 text-center">Ouverture de votre espace…</p>
        ) : !status || mode === "reset" ? (
          <>
            <div className={styles.authGrid}>
              <StudioInspiration onStart={() => setMode("signup")} />
              <form
                id="studio-account"
                className={styles.account}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  setMessage("");
                  const f = new FormData(e.currentTarget),
                    email = String(f.get("email") || ""),
                    password = String(f.get("password") || "");
                  try {
                    if (mode === "recovery") {
                      await requestPasswordRecovery(email);
                      setMessage(
                        "Si ce compte existe, un e-mail permet de réinitialiser son accès.",
                      );
                    } else if (mode === "reset") {
                      await updateUser({ password });
                      setMode("login");
                      await refresh();
                    } else if (mode === "signup") {
                      const u = await signup(email, password, {
                        full_name: String(f.get("name") || ""),
                      });
                      if (!u.confirmedAt)
                        setMessage(
                          "Consultez votre boîte e-mail et confirmez votre adresse pour ouvrir votre espace.",
                        );
                      else await refresh();
                    } else {
                      await login(email, password);
                      await refresh();
                    }
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Connexion impossible.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {mode === "signup" && (
                  <p className={styles.accountBadge}>
                    14 jours pour explorer · Sans carte bancaire
                  </p>
                )}
                <h2 className="text-2xl font-semibold">
                  {mode === "signup"
                    ? "Votre site commence ici."
                    : mode === "login"
                      ? "Retrouver mon site"
                      : mode === "reset"
                        ? "Nouveau mot de passe"
                        : "Récupérer mon accès"}
                </h2>
                <p className={styles.accountIntro}>
                  {mode === "signup"
                    ? "Créez votre compte. Votre premier aperçu restera privé : vous seul décidez de sa mise en ligne."
                    : mode === "login"
                      ? "Vos idées et votre brouillon vous attendent."
                      : "Retrouvez votre espace en toute simplicité."}
                </p>
                <div className="mt-6 space-y-4">
                  {mode === "signup" && (
                    <label className="block text-sm">
                      Votre nom
                      <input
                        className={input}
                        name="name"
                        required
                        autoComplete="name"
                      />
                    </label>
                  )}
                  {mode !== "reset" && (
                    <label className="block text-sm">
                      Adresse e-mail professionnelle
                      <input
                        className={input}
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                      />
                    </label>
                  )}
                  {mode !== "recovery" && (
                    <label className="block text-sm">
                      Mot de passe
                      <input
                        className={input}
                        name="password"
                        type="password"
                        minLength={10}
                        required
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                      />
                    </label>
                  )}
                  {mode === "signup" && (
                    <label className="block text-xs leading-relaxed text-slate-600">
                      <input
                        type="checkbox"
                        required
                        className="mr-2 align-middle"
                      />
                      Je crée cet espace pour mon entreprise et j’accepte les{" "}
                      <a
                        href="/studio/conditions"
                        className="underline"
                        target="_blank"
                      >
                        conditions de l’essai
                      </a>
                      .
                    </label>
                  )}
                  <button className={primary + " w-full"} disabled={busy}>
                    {busy
                      ? "Un instant…"
                      : mode === "signup"
                        ? "Créer mon aperçu gratuit →"
                        : mode === "login"
                          ? "Me connecter"
                          : mode === "reset"
                            ? "Enregistrer"
                            : "Recevoir un lien"}
                  </button>
                </div>
                {mode === "signup" && (
                  <>
                    <p className={styles.accountNote}>
                      0 € aujourd’hui. Aucun prélèvement automatique à la fin de
                      l’essai.
                    </p>
                    <div className={styles.accountDetails}>
                      <span>Cinq pages pour présenter votre activité</span>
                      <span>Trois générations IA incluses dans l’essai</span>
                      <span>Vos textes et vos images restent modifiables</span>
                    </div>
                    <p className={styles.pilot}>
                      Accès pilote : la création est actuellement réservée aux
                      comptes invités. Contact : contact@flex-web.fr.
                    </p>
                  </>
                )}
                <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-500">
                  <button
                    type="button"
                    onClick={() =>
                      setMode(mode === "signup" ? "login" : "signup")
                    }
                  >
                    {mode === "signup"
                      ? "J’ai déjà un compte"
                      : "Créer un compte"}
                  </button>
                  <button type="button" onClick={() => setMode("recovery")}>
                    Mot de passe oublié
                  </button>
                </div>
              </form>
            </div>
            <StudioJourney onStart={() => setMode("signup")} />
          </>
        ) : !s ? (
          <section className="mx-auto max-w-3xl">
            <StudioProgress step={0} />
            <p className="text-sm text-blue-700">
              Étape 1 · Présentez votre entreprise
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Commençons par ce qui vous rend unique.
            </h1>
            <p className="mt-3 text-slate-500">
              Les informations ci-dessous serviront à préparer votre aperçu.
              Vous pourrez les modifier.
            </p>
            {!status.allowed ? (
              <p className="mt-8 rounded-2xl bg-white p-6">
                Les essais sont actuellement réservés aux comptes pilotes.
                Écrivez à contact@flex-web.fr pour être accompagné.
              </p>
            ) : (
              <form
                className="mt-8 space-y-5 rounded-3xl border bg-white p-6 md:p-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  call("create", { brief, accepted: true });
                }}
              >
                <div className="grid gap-5 md:grid-cols-2">
                  {field("company", "Nom de l’entreprise", false, true)}
                  {field("activity", "Votre métier", false, true)}
                  {field("city", "Ville", false, true)}
                  {field("area", "Zone d’intervention")}
                  {field("phone", "Téléphone professionnel", false, true)}
                  {field("email", "E-mail de contact public", false, true)}
                </div>
                {field(
                  "description",
                  "Décrivez votre activité (20 caractères minimum)",
                  true,
                  true,
                )}
                {field("services", "Vos prestations", true, true)}
                {field("about", "Présentez votre entreprise", true)}
                <label className="flex gap-2 text-sm">
                  <input type="checkbox" required />
                  Je confirme pouvoir utiliser ces informations et accepte les{" "}
                  <a
                    href="/studio/conditions"
                    className="underline"
                    target="_blank"
                  >
                    conditions de l’essai
                  </a>
                  .
                </label>
                <button className={primary} disabled={busy}>
                  Créer mon aperçu privé →
                </button>
              </form>
            )}
          </section>
        ) : (
          <>
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                  Mon site
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  {s.brief.company}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {s.state === "LIVE"
                    ? "Site publié"
                    : s.state === "SUSPENDED"
                      ? "Publication suspendue"
                      : s.state === "EXPIRED"
                        ? "Essai terminé — aperçu conservé"
                        : `Essai privé jusqu’au ${date(s.trialEndsAt)}`}{" "}
                  · {s.quotaUsed}/{s.quotaLimit} utilisations IA
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.publishedAt && (
                  <a href={s.publicUrl} target="_blank" className={button}>
                    Ouvrir le site ↗
                  </a>
                )}
                <button
                  className={primary}
                  disabled={busy || !canEdit || running}
                  onClick={() =>
                    call("save", { brief, draft, revision: s.draftRevision })
                  }
                >
                  {dirty ? "Enregistrer le brouillon" : "Brouillon enregistré"}
                </button>
              </div>
            </div>
            <StudioProgress
              step={
                tab === "entreprise"
                  ? 0
                  : ["publication", "facturation"].includes(tab)
                    ? 2
                    : 1
              }
              onStep={setTab}
            />
            <nav
              className="mb-6 flex gap-2 overflow-x-auto"
              aria-label="Espace client"
            >
              {[
                ["contenu", "Contenus"],
                ["entreprise", "Entreprise"],
                ["apparence", "Photos & style"],
                ["publication", "Publication"],
                ["demandes", `Demandes (${s.inquiries.length})`],
                ["facturation", "Abonnement"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? primary : button}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {!canEdit && (
              <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm">
                Votre aperçu est conservé. Souscrivez ou régularisez votre
                abonnement pour modifier et publier votre site.
              </p>
            )}
            <div
              className={
                tab === "contenu" || tab === "apparence"
                  ? "grid items-start gap-6 xl:grid-cols-[370px_1fr]"
                  : ""
              }
            >
              <section className="space-y-5 rounded-2xl border bg-white p-5 md:p-6">
                {tab === "contenu" && draft && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                      Votre atelier de création
                    </p>
                    <h2 className="text-xl font-semibold">
                      Faites parler votre savoir-faire.
                    </h2>
                    <p className="text-sm text-slate-500">
                      Un premier texte ou une nouvelle tonalité ? Décrivez ce
                      que vous souhaitez. Enregistrez vos modifications avant de
                      lancer l’IA.
                    </p>
                    <textarea
                      className={input}
                      placeholder="Facultatif : un ton plus chaleureux, des textes plus courts…"
                      maxLength={1200}
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      disabled={running}
                    />
                    <button
                      className={primary + " w-full"}
                      disabled={
                        busy ||
                        running ||
                        dirty ||
                        !canEdit ||
                        !status.aiEnabled ||
                        s.quotaUsed >= s.quotaLimit
                      }
                      onClick={() =>
                        call("generate", {
                          requestKey: crypto.randomUUID(),
                          revision: s.draftRevision,
                          instruction,
                        })
                      }
                    >
                      {running
                        ? "Rédaction en cours…"
                        : "Rédiger / retoucher avec l’IA"}
                    </button>
                    {!status.aiEnabled && (
                      <p className="text-xs text-slate-500">
                        La génération IA est en cours d’ouverture pour les
                        comptes pilotes.
                      </p>
                    )}
                    {s.jobs[0]?.error && (
                      <p className="text-sm text-amber-800">
                        {s.jobs[0].error}
                      </p>
                    )}
                    <fieldset
                      disabled={!canEdit || running}
                      className="space-y-4"
                    >
                      <label className="block text-sm">
                        Accroche d’accueil
                        <input
                          className={input}
                          maxLength={180}
                          value={draft.tagline}
                          onChange={(e) => {
                            setDraft({ ...draft, tagline: e.target.value });
                            setDirty(true);
                          }}
                        />
                      </label>
                      <label className="block text-sm">
                        Page à modifier
                        <select
                          className={input}
                          value={page}
                          onChange={(e) => {
                            setPage(e.target.value);
                            setPreviewPage(e.target.value);
                          }}
                        >
                          {draft.pages.map((p) => (
                            <option key={p.slug} value={p.slug}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      {draft.pages
                        .find((p) => p.slug === page)
                        ?.sections.map((section, i) => (
                          <div
                            key={i}
                            className="space-y-3 rounded-xl bg-slate-50 p-3"
                          >
                            <label className="block text-xs">
                              Titre
                              <input
                                className={input}
                                maxLength={180}
                                value={section.title}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    pages: draft.pages.map((p) =>
                                      p.slug === page
                                        ? {
                                            ...p,
                                            sections: p.sections.map((x, n) =>
                                              n === i
                                                ? {
                                                    ...x,
                                                    title: e.target.value,
                                                  }
                                                : x,
                                            ),
                                          }
                                        : p,
                                    ),
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                            <label className="block text-xs">
                              Texte
                              <textarea
                                className={input}
                                rows={7}
                                maxLength={5000}
                                value={section.body}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    pages: draft.pages.map((p) =>
                                      p.slug === page
                                        ? {
                                            ...p,
                                            sections: p.sections.map((x, n) =>
                                              n === i
                                                ? { ...x, body: e.target.value }
                                                : x,
                                            ),
                                          }
                                        : p,
                                    ),
                                  });
                                  setDirty(true);
                                }}
                              />
                            </label>
                            <label className="block text-xs">
                              Photo
                              <select
                                className={input}
                                value={section.imageId}
                                onChange={(e) => {
                                  setDraft({
                                    ...draft,
                                    pages: draft.pages.map((p) =>
                                      p.slug === page
                                        ? {
                                            ...p,
                                            sections: p.sections.map((x, n) =>
                                              n === i
                                                ? {
                                                    ...x,
                                                    imageId: e.target.value,
                                                  }
                                                : x,
                                            ),
                                          }
                                        : p,
                                    ),
                                  });
                                  setDirty(true);
                                }}
                              >
                                <option value="">Sans photo</option>
                                {s.assets.map((a, n) => (
                                  <option key={a.id} value={a.id}>
                                    Photo {n + 1}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex gap-2">
                              <button
                                className={button}
                                disabled={i === 0}
                                onClick={() => {
                                  setDraft({
                                    ...draft,
                                    pages: draft.pages.map((p) => {
                                      if (p.slug !== page) return p;
                                      const sections = [...p.sections];
                                      [sections[i - 1], sections[i]] = [
                                        sections[i],
                                        sections[i - 1],
                                      ];
                                      return { ...p, sections };
                                    }),
                                  });
                                  setDirty(true);
                                }}
                              >
                                Monter
                              </button>
                              <button
                                className={button}
                                onClick={() => {
                                  setDraft({
                                    ...draft,
                                    pages: draft.pages.map((p) =>
                                      p.slug === page
                                        ? {
                                            ...p,
                                            sections: p.sections.filter(
                                              (_, n) => n !== i,
                                            ),
                                          }
                                        : p,
                                    ),
                                  });
                                  setDirty(true);
                                }}
                              >
                                Retirer
                              </button>
                            </div>
                          </div>
                        ))}
                      <button
                        className={button}
                        disabled={
                          (draft.pages.find((p) => p.slug === page)?.sections
                            .length || 0) >= 8
                        }
                        onClick={() => {
                          setDraft({
                            ...draft,
                            pages: draft.pages.map((p) =>
                              p.slug === page
                                ? {
                                    ...p,
                                    sections: [
                                      ...p.sections,
                                      { title: "", body: "", imageId: "" },
                                    ],
                                  }
                                : p,
                            ),
                          });
                          setDirty(true);
                        }}
                      >
                        Ajouter une section
                      </button>
                    </fieldset>
                  </>
                )}
                {tab === "entreprise" && (
                  <fieldset
                    disabled={!canEdit || running}
                    className="mx-auto max-w-3xl space-y-5"
                  >
                    <h2 className="text-xl font-semibold">
                      Informations de l’entreprise
                    </h2>
                    <div className="grid gap-5 md:grid-cols-2">
                      {field("company", "Entreprise")}
                      {field("activity", "Métier")}
                      {field("city", "Ville")}
                      {field("area", "Zone d’intervention")}
                      {field("phone", "Téléphone")}
                      {field("email", "E-mail public")}
                    </div>
                    {field("description", "Activité", true)}
                    {field("services", "Prestations", true)}
                    {field("about", "Présentation", true)}
                    <h3 className="border-t pt-5 font-semibold">
                      À compléter avant publication
                    </h3>
                    <div className="grid gap-5 md:grid-cols-2">
                      {field("legalName", "Raison sociale")}
                      {field("legalForm", "Forme juridique")}
                      {field("siren", "SIREN (9 chiffres)")}
                      {field("contactName", "Responsable de publication")}
                    </div>
                    {field("address", "Adresse professionnelle", true)}
                    <p className="text-xs text-slate-500">
                      Ces informations figureront dans les mentions légales de
                      votre site.
                    </p>
                  </fieldset>
                )}
                {tab === "apparence" && (
                  <fieldset
                    disabled={!canEdit || running}
                    className="space-y-5"
                  >
                    <h2 className="text-xl font-semibold">
                      Votre identité visuelle
                    </h2>
                    <label className="block text-sm">
                      Ambiance
                      <select
                        className={input}
                        value={brief.theme}
                        onChange={(e) => {
                          setBrief({
                            ...brief,
                            theme: e.target.value as Brief["theme"],
                          });
                          setDirty(true);
                        }}
                      >
                        <option value="atelier">
                          Atelier · chaleureux et éditorial
                        </option>
                        <option value="essentiel">
                          Essentiel · clair et contemporain
                        </option>
                        <option value="nature">Nature · doux et épuré</option>
                      </select>
                    </label>
                    {field("color", "Couleur de marque")}
                    <label className="block text-sm">
                      Ajouter une photo ou un logo
                      <input
                        className={input}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => upload(e.target.files?.[0])}
                      />
                    </label>
                    <p className="text-xs text-slate-500">
                      JPEG, PNG ou WebP, 4 Mo maximum. Utilisez uniquement des
                      images que vous avez le droit de publier.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {s.assets.map((a, n) => (
                        <div key={a.id}>
                          <img
                            src={`/api/studio/media/${a.id}`}
                            alt={`Photo ${n + 1}`}
                            className="aspect-square rounded-lg object-cover"
                          />
                          <p className="mt-1 text-xs">Photo {n + 1}</p>
                        </div>
                      ))}
                    </div>
                    <label className="block text-sm">
                      Logo
                      <select
                        className={input}
                        value={brief.logoId}
                        onChange={(e) => {
                          setBrief({ ...brief, logoId: e.target.value });
                          setDirty(true);
                        }}
                      >
                        <option value="">
                          Afficher le nom de l’entreprise
                        </option>
                        {s.assets.map((a, n) => (
                          <option key={a.id} value={a.id}>
                            Photo {n + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>
                )}
                {tab === "publication" && (
                  <div className="mx-auto max-w-3xl space-y-6">
                    <h2 className="text-xl font-semibold">
                      Votre dernière étape avant la mise en ligne
                    </h2>
                    {!isPaid && <PublicationOffer />}
                    <p className="text-slate-600">
                      Vérifiez les pages et les coordonnées dans l’aperçu. Les
                      sections vides sont masquées. Les informations légales
                      doivent être complètes.
                    </p>
                    <label className="flex gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                      />
                      J’ai vérifié le contenu, je dispose des droits sur les
                      photos et je valide cette version. Pour souscrire,
                      j’accepte les{" "}
                      <a
                        href="/studio/conditions"
                        target="_blank"
                        className="underline"
                      >
                        conditions de l’offre Autonome
                      </a>
                      .
                    </label>
                    {isPaid ? (
                      <button
                        className={primary}
                        disabled={busy || dirty || !accepted || running}
                        onClick={() =>
                          call("publish", {
                            revision: s.draftRevision,
                            confirmed: true,
                          })
                        }
                      >
                        Publier cette version
                      </button>
                    ) : (
                      <button
                        className={primary}
                        disabled={
                          busy ||
                          dirty ||
                          !accepted ||
                          !status.paymentsEnabled ||
                          running
                        }
                        onClick={() =>
                          call("checkout", {
                            revision: s.draftRevision,
                            accepted: true,
                          })
                        }
                      >
                        Publier à 49 € HT/mois →
                      </button>
                    )}
                    {dirty && (
                      <p className="text-sm text-amber-800">
                        Enregistrez vos modifications avant de publier.
                      </p>
                    )}
                    {!status.paymentsEnabled && !isPaid && (
                      <p className="text-sm text-slate-500">
                        Les paiements sont désactivés pendant la phase de
                        vérification. Aucun prélèvement possible.
                      </p>
                    )}
                    {s.hasPrevious && (
                      <button
                        className={button + " ml-3"}
                        disabled={busy || !accepted}
                        onClick={() =>
                          call("restore", {
                            revision: s.draftRevision,
                            confirmed: true,
                          })
                        }
                      >
                        Restaurer la version précédente
                      </button>
                    )}
                    <div className="border-t pt-6">
                      <h3 className="font-semibold">Adresse de votre site</h3>
                      <p className="mt-2 break-all text-sm">{s.publicUrl}</p>
                      <p className="mt-5 text-sm text-slate-500">
                        Vous possédez déjà un domaine ? Connectez par exemple
                        www.monentreprise.fr. Son achat et son renouvellement
                        restent auprès de votre fournisseur.
                      </p>
                      <label className="mt-3 block text-sm">
                        Votre domaine
                        <input
                          className={input}
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          placeholder="www.monentreprise.fr"
                        />
                      </label>
                      <button
                        className={button + " mt-3"}
                        disabled={busy}
                        onClick={() => call("domain", { domain })}
                      >
                        Préparer la connexion
                      </button>
                      {s.domain && (
                        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                          <p>
                            Chez votre fournisseur, ajoutez ces deux
                            enregistrements :
                          </p>
                          <p className="break-all">
                            <strong>TXT</strong> · _flexweb.{s.domain}
                            <br />
                            {s.domainToken}
                          </p>
                          <p>
                            <strong>CNAME</strong> · {s.domain}
                            <br />
                            flexweb-gestion.netlify.app
                          </p>
                          <p>
                            État :{" "}
                            {s.domainState === "VERIFIED"
                              ? "Connecté et HTTPS vérifié"
                              : "En attente"}
                          </p>
                          {s.domainError && <p>{s.domainError}</p>}
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => call("verify-domain")}
                          >
                            Vérifier la connexion
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {tab === "demandes" && (
                  <div className="mx-auto max-w-3xl space-y-5">
                    <h2 className="text-xl font-semibold">
                      Demandes reçues sur votre site
                    </h2>
                    {!s.inquiries.length && (
                      <p className="text-slate-500">
                        Les demandes du formulaire apparaîtront ici après
                        publication.
                      </p>
                    )}
                    {s.inquiries.map((q) => (
                      <article className="rounded-xl border p-4" key={q.id}>
                        <p className="font-semibold">
                          {q.name}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {date(q.createdAt)}
                          </span>
                        </p>
                        <a
                          href={`mailto:${q.email}`}
                          className="text-sm text-blue-700"
                        >
                          {q.email}
                        </a>
                        <p className="mt-3 whitespace-pre-wrap text-sm">
                          {q.message}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
                {tab === "facturation" && (
                  <div className="mx-auto max-w-3xl space-y-5">
                    <PublicationOffer />
                    <h2 className="text-xl font-semibold">
                      Un abonnement simple
                    </h2>
                    <p className="text-4xl font-semibold">
                      49 €{" "}
                      <span className="text-lg font-normal text-slate-500">
                        HT / mois
                      </span>
                    </p>
                    <p>
                      Sans frais de création. Les taxes et le total sont
                      affichés avant paiement. Résiliation à la fin de la
                      période payée.
                    </p>
                    <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
                      <li>Un site vitrine de cinq pages</li>
                      <li>Hébergement et connexion de votre domaine</li>
                      <li>
                        Édition manuelle libre et 20 retouches IA par mois
                      </li>
                      <li>Réception des demandes de contact</li>
                    </ul>
                    <p className="text-sm">
                      {s.paidThrough
                        ? `Période payée jusqu’au ${date(s.paidThrough)}${s.cancelAtPeriodEnd ? " · résiliation programmée" : ""}`
                        : `Essai gratuit jusqu’au ${date(s.trialEndsAt)}`}
                    </p>
                    {s.billingStatus === "UNPAID" && (
                      <button
                        className={primary}
                        onClick={() => setTab("publication")}
                      >
                        Préparer ma mise en ligne →
                      </button>
                    )}
                    {s.billingStatus !== "UNPAID" && (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => call("billing")}
                      >
                        Factures, paiement et résiliation ↗
                      </button>
                    )}
                    <p className="text-sm text-slate-500">
                      Vous créez et modifiez votre site vous-même. Une
                      réalisation sur mesure ou une intervention humaine relève
                      des offres accompagnées.
                    </p>
                    <a
                      href="mailto:contact@flex-web.fr"
                      className="text-sm text-blue-700"
                    >
                      Besoin d’aide : contact@flex-web.fr
                    </a>
                  </div>
                )}
              </section>
              {(tab === "contenu" || tab === "apparence") && draft && (
                <section className="overflow-hidden rounded-2xl border bg-slate-100">
                  <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Aperçu privé · {dirty ? "non enregistré" : "brouillon"}
                    </span>
                    <button
                      className={button}
                      onClick={() => setMobile(!mobile)}
                    >
                      {mobile ? "Vue large" : "Vue étroite"}
                    </button>
                  </div>
                  <div className="max-h-[850px] overflow-auto p-2">
                    <div
                      className={
                        mobile ? "mx-auto max-w-[390px] shadow-lg" : ""
                      }
                    >
                      <SiteView
                        data={{ brief, content: draft }}
                        siteId={s.id}
                        pageSlug={previewPage}
                        preview
                        onPage={setPreviewPage}
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
