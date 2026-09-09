/** @param {{ tiers?: { label: string, price: string }[] }} props */
export default function BuyoutSection({ tiers = [] }) {
  return (
    <details className="group rounded-2xl border border-black/10 bg-white">
      <summary className="cursor-pointer px-5 py-5 text-base font-semibold text-[#1d1d1f] sm:px-7">
        Déjà abonné ? Comprendre le rachat de votre site
      </summary>
      <div className="space-y-5 px-5 pb-6 text-sm leading-relaxed text-[#52525b] sm:px-7">
        <p>
          Le rachat permet de devenir propriétaire d’une version autonome de
          votre site après avoir commencé avec un abonnement. C’est un paiement
          unique supplémentaire, uniquement si vous choisissez cette option.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div key={tier.label} className="rounded-xl bg-[#f5f5f7] p-4">
              <p className="text-xs">{tier.label} d’abonnement</p>
              <p className="mt-2 text-xl font-semibold text-[#1d1d1f]">
                {tier.price}
              </p>
            </div>
          ))}
        </div>
        <p>
          Vos textes, images, logo et documents restent toujours votre
          propriété. Lors du rachat, nous vous remettons une version autonome du
          site. L’hébergement, la maintenance et le support prennent fin, sauf
          souscription distincte.
        </p>
        <a
          href="/cgv/"
          className="inline-block font-medium text-[#0071e3] underline underline-offset-4"
        >
          Lire les conditions de résiliation et de rachat
        </a>
      </div>
    </details>
  );
}
