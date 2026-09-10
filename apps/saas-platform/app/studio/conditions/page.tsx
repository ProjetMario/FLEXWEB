import Link from "next/link";
export const metadata = { title: "Conditions de l’offre Autonome" };
export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 py-12 text-slate-700">
      <Link href="/studio" className="text-blue-700">
        ← Mon espace
      </Link>
      <h1 className="text-3xl font-semibold text-slate-900">
        FLEX-WEB Autonome
      </h1>
      <p>
        Version du 10 septembre 2026. Offre destinée aux professionnels, en
        complément des{" "}
        <a className="underline" href="https://flex-web.fr/cgv/">
          conditions générales FLEX-WEB
        </a>
        .
      </p>
      <h2 className="text-xl font-semibold">Essai privé</h2>
      <p>
        Un compte vérifié peut créer un site d’essai pendant 14 jours, sans
        carte bancaire. Trois générations IA sont incluses. L’aperçu n’est pas
        public. Après l’essai, il reste consultable mais les modifications
        nécessitent un abonnement.
      </p>
      <h2 className="text-xl font-semibold">Abonnement</h2>
      <p>
        49 € HT par mois, sans frais de création. Les taxes applicables et le
        montant total sont affichés avant paiement. L’abonnement inclut un site
        vitrine de cinq pages, son hébergement, l’édition manuelle, vingt
        retouches IA par période mensuelle payée et les demandes de contact. Les
        quotas ne sont pas reportables. La génération est soumise à une
        disponibilité et à un plafond collectif ; son interruption n’empêche pas
        l’édition manuelle.
      </p>
      <h2 className="text-xl font-semibold">Vos contenus et votre domaine</h2>
      <p>
        Vous fournissez et vérifiez les informations de votre entreprise, les
        mentions nécessaires à votre activité et les droits d’utilisation des
        images. Les textes de l’IA sont des propositions à relire. La
        publication requiert votre validation. Votre domaine reste acheté et
        renouvelé auprès de votre fournisseur ; FLEX-WEB fournit une adresse de
        publication et une procédure de connexion DNS.
      </p>
      <h2 className="text-xl font-semibold">Résiliation et paiement</h2>
      <p>
        Vous pouvez demander la résiliation dans votre portail de facturation.
        Le site reste accessible jusqu’à la fin de la période payée, puis sa
        publication est suspendue. En cas d’impayé, une notification prévoit
        sept jours pour régulariser avant suspension. Votre contenu reste
        conservé dans votre espace ; aucune suppression automatique n’est prévue
        dans cette version.
      </p>
      <h2 className="text-xl font-semibold">Périmètre</h2>
      <p>
        Cette offre autonome n’inclut pas de réalisation sur mesure, de
        boutique, de réservation ni de modifications réalisées par une personne.
        Elle ne garantit pas un nombre de visiteurs ou de clients. Les demandes
        d’assistance peuvent être adressées à contact@flex-web.fr.
      </p>
      <p className="text-sm">
        FLEX-WEB traite les informations du compte pour fournir le service. Les
        contenus nécessaires à la rédaction sont transmis au service IA ; les
        coordonnées privées des prospects du CRM ne sont pas transmises à l’IA.
        Pour toute demande relative à vos données : contact@flex-web.fr.
      </p>
    </main>
  );
}
