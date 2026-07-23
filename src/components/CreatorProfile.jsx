import { MotionWrapper } from "./utils/MotionWrapper.jsx";

export default function CreatorProfile({ data = [] }) {
  return (
    <>
      {data.map((creator, idx) => (
        <MotionWrapper key={idx} type="fade-up" className="w-full max-w-8xl mx-auto px-4 md:px-8 py-10" as="section">
          <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-8 items-start">
            <p className="text-sm font-light text-gray-700 leading-relaxed max-w-sm">
              {creator.description}
            </p>
            <div className="flex flex-col items-center text-center gap-1 px-8">
              <span className="font-light text-base text-gray-900">{creator.name}</span>
              <span className="font-light text-sm text-gray-400">{creator.title}</span>
              <span className="font-light text-xs text-gray-400 uppercase tracking-widest">{creator.handle}</span>
            </div>
            <img
              loading="lazy"
              src={creator.image}
              alt={creator.name}
              className="w-full object-cover rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-6 md:hidden">
            <img
              loading="lazy"
              src={creator.image}
              alt={creator.name}
              className="w-full object-cover rounded-xl"
            />
            <div className="flex flex-col gap-1">
              <span className="font-light text-base text-gray-900">{creator.name}</span>
              <span className="font-light text-sm text-gray-400">{creator.title}</span>
              <span className="font-light text-xs text-gray-400 uppercase tracking-widest">{creator.handle}</span>
            </div>
            <p className="text-sm font-light text-gray-500 leading-relaxed">
              {creator.description}
            </p>
          </div>
        </MotionWrapper>
      ))}
    </>
  );
}
