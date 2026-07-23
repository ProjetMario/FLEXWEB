import { SkeletonImage, SkeletonText, SkeletonHeading, SkeletonLabel, SkeletonBlock } from "./Skeleton.jsx";

export default function SplitLayoutSkeleton() {
  return (
    <section className="min-h-screen flex items-center justify-center">
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="hidden md:flex flex-col p-8 gap-6">
          <SkeletonHeading className="h-8 w-3/4 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-gray-200 pb-4 flex justify-between items-center">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-5 w-5" />
            </div>
          ))}
          <SkeletonText lines={2} className="mt-4" />
        </div>

        <div className="flex flex-col md:h-[750px] px-4 md:px-0 gap-4">
          <SkeletonHeading className="h-7 w-2/3 block md:hidden mb-2" />
          <SkeletonImage className="flex-1 rounded-2xl min-h-[300px]" />
          <div className="py-4 flex flex-col gap-2">
            <SkeletonLabel />
            <SkeletonText lines={2} />
          </div>
        </div>

      </div>
    </section>
  );
}
