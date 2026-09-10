"use client";
import { useState } from "react";
import styles from "./StudioDesign.module.css";

const examples = [
  {
    label: "Artisan",
    name: "Atelier & matière",
    title: "Le soin du détail.\nLe goût du travail bien fait.",
    activity: "MENUISERIE · CRÉATION · RÉNOVATION",
    color: "#345447",
    background: "#e6ddca",
  },
  {
    label: "Indépendant",
    name: "Studio Horizon",
    title: "Vos idées prennent\nune nouvelle dimension.",
    activity: "CONSEIL · STRATÉGIE · ACCOMPAGNEMENT",
    color: "#304b98",
    background: "#d8e2f2",
  },
  {
    label: "Service local",
    name: "Les jours fleuris",
    title: "Un peu de nature.\nBeaucoup d’attention.",
    activity: "FLEURS · COMPOSITIONS · ÉVÉNEMENTS",
    color: "#793e50",
    background: "#efd9d5",
  },
];

export function StudioInspiration({ onStart }: { onStart: () => void }) {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return (
    <section className={styles.inspiration}>
      <p className={styles.eyebrow}>
        <span /> VOTRE PROCHAIN CHAPITRE COMMENCE ICI
      </p>
      <h1 className={styles.headline}>
        Votre savoir-faire.
        <br />
        Enfin, <em>votre site.</em>
      </h1>
      <p className={styles.intro}>
        Transformez votre activité en un site qui vous ressemble. L’IA vous aide
        à écrire. Vous choisissez, vous ajustez, vous publiez.
      </p>
      <a
        className={styles.mobileStart}
        href="#studio-account"
        onClick={onStart}
      >
        Créer mon aperçu gratuit →
      </a>
      <div
        className={styles.examplePicker}
        aria-label="Choisir un exemple de site"
      >
        {examples.map((item, index) => (
          <button
            type="button"
            key={item.label}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className={styles.browser}
        style={
          {
            "--example-color": example.color,
            "--example-bg": example.background,
          } as React.CSSProperties
        }
      >
        <div className={styles.browserChrome}>
          <span aria-hidden="true">● ● ●</span>
          <span>Votre futur site, à imaginer ici</span>
          <span aria-hidden="true">↗</span>
        </div>
        <div className={styles.exampleNav}>
          <strong>{example.name}</strong>
          <span>Prestations &nbsp; À propos &nbsp; Contact</span>
        </div>
        <div className={styles.exampleBody}>
          <div>
            <p>{example.activity}</p>
            <h2>{example.title}</h2>
            <span className={styles.exampleCta}>
              Découvrir notre univers <span aria-hidden="true">↗</span>
            </span>
          </div>
          <div className={styles.artwork} aria-hidden="true">
            <div className={styles.arch} />
            <div className={styles.orb} />
            <div className={styles.pedestal} />
            <span>
              Votre identité,
              <br />
              votre univers.
            </span>
          </div>
        </div>
        <div className={styles.exampleFoot}>
          <span>01 — Présentez ce que vous faites</span>
          <span>02 — Facilitez le premier contact</span>
        </div>
      </div>
      <p className={styles.caption}>
        Exemple illustratif · Vos textes, vos photos et vos coordonnées rendront
        votre site unique.
      </p>
    </section>
  );
}

export function StudioJourney({ onStart }: { onStart: () => void }) {
  return (
    <section className={styles.journey} aria-labelledby="journey-title">
      <div className={styles.journeyHeading}>
        <p className={styles.eyebrow}>DE L’IDÉE À LA MISE EN LIGNE</p>
        <h2 id="journey-title">
          Vous connaissez votre métier.
          <br />
          On vous aide à le présenter.
        </h2>
      </div>
      <div className={styles.steps}>
        {[
          [
            "01",
            "Parlez de vous",
            "Votre activité, vos prestations, vos envies. Pas besoin de savoir coder.",
          ],
          [
            "02",
            "Donnez-lui votre style",
            "Découvrez vos cinq pages, ajustez les textes et ajoutez vos propres photos.",
          ],
          [
            "03",
            "Publiez à votre rythme",
            "Validez votre contenu puis souscrivez pour rendre votre site accessible.",
          ],
        ].map(([n, title, body]) => (
          <article key={n}>
            <span>{n}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className={styles.offer}>
        <div>
          <p className={styles.offerEyebrow}>VOTRE SITE, VOTRE AUTONOMIE</p>
          <h2>
            Créez d’abord.
            <br />
            Décidez ensuite.
          </h2>
          <p>
            Explorez votre aperçu privé pendant 14 jours.
            <br />
            Aucune carte à renseigner pour commencer.
          </p>
          <a href="#studio-account" onClick={onStart}>
            Créer mon aperçu gratuit <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className={styles.offerPrice}>
          <p>POUR PUBLIER VOTRE SITE</p>
          <div>
            <strong>49 €</strong>
            <span>HT / mois</span>
          </div>
          <p>0 € de frais de création</p>
          <ul>
            <li>Un site vitrine de cinq pages et son hébergement</li>
            <li>Édition manuelle et 20 retouches IA par mois payé</li>
            <li>Formulaire pour recevoir les demandes de contact</li>
          </ul>
          <small>
            Taxes affichées avant paiement. Résiliation en fin de période payée.
            Domaine non inclus. Vous créez et modifiez vos contenus.
          </small>
        </div>
      </div>
    </section>
  );
}

export function StudioProgress({
  step,
  onStep,
}: {
  step: number;
  onStep?: (tab: string) => void;
}) {
  return (
    <nav className={styles.progress} aria-label="Parcours de création">
      {[
        ["Votre entreprise", "entreprise"],
        ["Vos pages & votre style", "contenu"],
        ["Votre mise en ligne", "publication"],
      ].map(([label, tab], index) => (
        <button
          type="button"
          key={label}
          disabled={!onStep}
          aria-current={step === index ? "step" : undefined}
          onClick={() => onStep?.(tab)}
        >
          <span>{index + 1}</span>
          <strong>{label}</strong>
          {index < 2 && <i aria-hidden="true">→</i>}
        </button>
      ))}
    </nav>
  );
}

export function PublicationOffer() {
  return (
    <div className={styles.publicationOffer}>
      <div>
        <p className={styles.eyebrow}>PRÊT À ÊTRE DÉCOUVERT ?</p>
        <h3>Votre site prend sa place en ligne.</h3>
        <p>
          Vos prestations, votre identité et un moyen simple de vous contacter,
          réunis sur votre propre site.
        </p>
      </div>
      <div className={styles.publicationPrice}>
        <strong>49 €</strong>
        <span>HT / mois</span>
        <small>Sans frais de création</small>
      </div>
    </div>
  );
}
