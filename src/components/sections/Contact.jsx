import { SectionHeader } from "../ui/SectionHeader.jsx";
export default function Contact({ data = {} }) {
  const { label, title, description, details = [] } = data;
  return (
    <section id="contact" className="w-full bg-[#f5f5f7] py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
        <div>
          <SectionHeader label={label} title={title} />
          <p className="mt-5 max-w-md leading-relaxed text-[#6e6e73]">
            {description}
          </p>
          <div className="mt-8 space-y-4">
            {details.map((d) => (
              <div key={d.label}>
                <p className="text-xs font-semibold text-[#6e6e73]">
                  {d.label}
                </p>
                <p className="text-sm text-[#1d1d1f]">{d.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-black/5 bg-white p-8 sm:p-10">
          <p className="text-sm font-medium text-[#0071e3]">
            Votre projet commence ici
          </p>
          <h3 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Présentez votre activité.
            <br />
            Nous préparons la suite.
          </h3>
          <ol className="my-8 space-y-4 text-sm text-[#6e6e73]">
            <li>1. Décrivez votre besoin et vos outils actuels.</li>
            <li>2. Retrouvez votre proposition dans un espace privé.</li>
            <li>3. Validez le périmètre, le budget et le calendrier.</li>
          </ol>
          <a
            href="/demarrer/?service=automation"
            className="inline-flex rounded-full bg-[#0071e3] px-6 py-3 text-sm font-medium text-white"
          >
            Demander un devis automatisation IA
          </a>
          <p className="mt-4 text-xs text-[#6e6e73]">
            Demande gratuite · Aucun paiement avant validation du périmètre
          </p>
          <p className="mt-7 text-sm text-[#6e6e73]">
            Pour un autre projet :{" "}
            <a href="/demarrer/?service=site" className="text-[#0071e3] underline">devis site internet</a>
            {" · "}
            <a href="/demarrer/?service=application" className="text-[#0071e3] underline">devis application</a>.
          </p>
          <p className="mt-4 text-sm text-[#6e6e73]">
            Vous pouvez aussi nous écrire :{" "}
            <a
              href="mailto:contact@flex-web.fr"
              className="text-[#0071e3] underline"
            >
              contact@flex-web.fr
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
