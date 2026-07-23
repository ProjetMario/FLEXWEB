import { MotionWrapper, MotionChild } from "./utils/MotionWrapper.jsx";

export default function JournalListing({ data = [], featured = null }) {
  return (
    <>
      <MotionWrapper type="fade-up" className="w-full max-w-8xl mx-auto px-4 pt-10 pb-6" as="section">
        <hr className="mb-6 border-t border-gray-200" />
        <div className="flex items-end justify-between">
          <h1 className="text-4xl md:text-6xl font-light grotesque-font text-gray-900 leading-none">
            Journal
          </h1>
          <span className="text-xs text-gray-400 font-light uppercase tracking-widest mb-1">
            {data.length + (featured ? 1 : 0)} articles
          </span>
        </div>
        <p className="text-sm font-light text-gray-400 mt-4 max-w-xs leading-relaxed">
          Exploring the engineering ideas and innovations behind Dyson technology.
        </p>
      </MotionWrapper>

      {featured && (
        <MotionWrapper type="fade-up" className="w-full max-w-8xl mx-auto px-4 pb-12" as="section">
          <a
            href={`/journal/${featured.slug}`}
            className="group grid grid-cols-1 md:grid-cols-2 gap-0 border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 transition-colors duration-200"
          >
            <div className="relative overflow-hidden bg-[#f5ebda] aspect-[4/3] md:aspect-auto">
              <img
                loading="lazy"
                src={featured.image}
                alt={featured.title}
                className="w-full h-full object-contain p-8 transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col justify-between p-8 md:p-12">
              <div className="flex flex-col gap-4">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-light">Featured</span>
                <h2 className="text-2xl md:text-3xl font-light grotesque-font text-gray-900 leading-snug">
                  {featured.title}
                </h2>
                <p className="text-sm font-light text-gray-400 leading-relaxed max-w-sm">
                  {featured.description}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-8">
                <span className="text-sm font-light text-gray-900">Read article</span>
                <span className="text-xs opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-200">↗</span>
              </div>
            </div>
          </a>
        </MotionWrapper>
      )}

      <section className="w-full max-w-8xl mx-auto px-4 pb-20">
        <hr className="mb-6 border-t border-gray-200" />
        <h2 className="text-xs text-gray-400 uppercase tracking-widest font-light mb-8">All articles</h2>
        <MotionWrapper type="fade-up" isContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12 grotesque-font">
          {data.map((item) => (
            <MotionChild key={item.slug}>
              <a href={`/journal/${item.slug}`} className="group flex flex-col gap-0">
                <div className="overflow-hidden aspect-[4/3]">
                  <img
                    loading="lazy"
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="pt-4 flex flex-col gap-2">
                  <h3 className="text-sm font-light text-gray-900 flex items-center gap-1">
                    {item.title}
                    <span aria-hidden="true" className="text-[10px] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-200">↗</span>
                  </h3>
                  <p className="text-xs font-light text-gray-400 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </a>
            </MotionChild>
          ))}
        </MotionWrapper>
      </section>
    </>
  );
}
