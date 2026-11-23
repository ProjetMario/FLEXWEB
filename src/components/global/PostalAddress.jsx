import { footerBrand, postalAddress } from "../../data/business.ts";

const countries = { fr: "France", en: "France", de: "Frankreich", it: "Francia" };

export default function PostalAddress({ lang = "fr", className }) {
  return (
    <address data-flexweb-postal-address="" className={className} style={{ fontStyle: "normal" }}>
      <strong>{footerBrand}</strong><br />
      {postalAddress.streetAddress}<br />
      {postalAddress.postalCode} {postalAddress.addressLocality}, {countries[lang] ?? countries.fr}
    </address>
  );
}
