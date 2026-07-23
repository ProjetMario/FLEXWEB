import { MotionWrapper, MotionChild } from "../utils/MotionWrapper.jsx";

export default function BentoCard({ data = { cards: [] } }) {
  const { cards = [] } = data;

  return (
    <MotionWrapper type="fade-up" isContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-8xl mx-auto px-2 sm:px-4" as="section">
      {cards.map((card) => {
        let sizeClass = "";
        if (card.size === "large") {
          sizeClass = "md:col-span-2 md:row-span-2 aspect-square";
        } else if (card.size === "medium") {
          sizeClass = "md:col-span-2 md:row-span-1 aspect-[4/1]";
        } else {
          sizeClass = "col-span-1 row-span-1 aspect-square";
        }

        return (
          <MotionChild
            key={card.id}
            className={`rounded-xl flex flex-col relative overflow-hidden transition-transform duration-200 ease-in-out hover:-translate-y-1 ${sizeClass}`}
          >
            <div className="flex bg-[#f5ebda] items-center justify-center p-4 sm:p-8 h-full w-full">
              <img
                loading="lazy"
                src={card.image}
                className="max-w-full object-contain mx-auto"
                alt={card.name}
              />
            </div>
            <div className="absolute top-0 left-0 w-full flex justify-between items-center px-4 py-3">
              <span className="text-base text-gray-800 font-light">{card.name}</span>
            </div>
          </MotionChild>
        );
      })}
    </MotionWrapper>
  );
}
