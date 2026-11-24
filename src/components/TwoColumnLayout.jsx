import { MotionWrapper } from "./utils/MotionWrapper.jsx";

const formUrl = /(https:\/\/flex-web\.fr\/contact\/|https:\/\/www\.medconsodev\.eu\/mediation-consommation-demande\.php)/;
function linkedParagraph(text) {
  return text.split(formUrl).map((part, index) => index % 2 === 1
    ? <a key={index} href={part} className="underline">{part}</a>
    : part);
}

export default function TwoColumnLayout({ data = { sections: [], updated: "" } }) {
  const { sections = [], updated = "" } = data;

  return (
    <MotionWrapper type="fade-up" className="max-w-7xl grotesque-font mx-auto px-4" as="section">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start p-0">
        <div className="md:col-span-1">
          {updated && (
            <div className="text-xs text-gray-400 mb-6 md:mb-0">{`Updated ${updated}`}</div>
          )}
        </div>
        <div className="md:col-span-2">
          {sections.map((section, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div>
                <h2 className="text-sm font-light text-gray-400 mb-2">{section.title}</h2>
              </div>
              <div>
                {section.content.map((para, pIdx) => (
                  <p key={pIdx} className="text-sm font-light text-gray-700 mb-4">{linkedParagraph(para)}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MotionWrapper>
  );
}
