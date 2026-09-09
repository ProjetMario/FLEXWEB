/** @param {{ rows?: import("../../data/pricing").ComparisonRow[], plans?: { id: string, name: string }[] }} props */
export default function ComparisonTable({ rows = [], plans = [] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10">
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Comparaison des quatre offres — faites défiler horizontalement si nécessaire"
      >
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Ce qui est inclus dans Essentielle, Professionnelle, Croissance et
            Achat définitif
          </caption>
          <thead className="bg-[#f5f5f7]">
            <tr>
              <th scope="col" className="px-5 py-5 font-medium text-[#52525b]">
                Votre besoin
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className="px-4 py-5 text-center font-semibold text-[#1d1d1f]"
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.label}
                className={index % 2 ? "bg-[#fbfbfd]" : "bg-white"}
              >
                <th
                  scope="row"
                  className="border-t border-black/[0.06] px-5 py-4 font-medium text-[#424245]"
                >
                  {row.label}
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.id}
                    className="border-t border-black/[0.06] px-4 py-4 text-center text-[#52525b]"
                  >
                    {row[plan.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-black/10 bg-[#fbfbfd] px-5 py-4 text-xs leading-relaxed text-[#52525b]">
        Les 30 minutes de modifications incluses ne sont pas reportables. Les
        demandes hors périmètre font l’objet d’un devis avant intervention.
      </p>
    </div>
  );
}
