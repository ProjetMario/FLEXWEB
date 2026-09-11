/** Public identity shared by HTML and search summaries. */
export const business = {
  name: "Flex-Web",
  legalName: "Fleximmo",
  url: "https://flex-web.fr",
  email: "contact@flex-web.fr",
  telephone: "+33757830262",
  description: "Flex-Web accompagne les entreprises dans l’automatisation des tâches avec l’IA, la création de sites internet et le développement d’applications. Basé à Voglans, en Savoie, le studio intervient en Haute-Savoie et à distance partout en France.",
};
export const canonicalUrlFor = (pathname: string) => {
  const path = pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`;
  return new URL(path, business.url).toString();
};
export const organizationSchema = {
  "@type": "ProfessionalService", "@id": `${business.url}/#organization`, ...business,
  address: { "@type": "PostalAddress", streetAddress: "93 chemin de la Combe", postalCode: "73420", addressLocality: "Voglans", addressCountry: "FR" },
  logo: `${business.url}/logo.png`, image: `${business.url}/logo.png`,
  areaServed: [
    { "@type": "AdministrativeArea", name: "Savoie" },
    { "@type": "AdministrativeArea", name: "Haute-Savoie" },
    { "@type": "Country", name: "France" },
  ],
  knowsAbout: ["Automatisation de tâches avec l’IA", "Intégration CRM", "Création de sites internet", "Développement d’applications web et mobiles", "Référencement naturel"],
};
