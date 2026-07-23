export function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: i === lines - 1 ? "65%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonImage({ className = "" }) {
  return (
    <div className={`skeleton w-full relative flex items-center justify-center ${className}`}>
      <span className="absolute text-[10px] uppercase tracking-[0.3em] text-gray-400/50 select-none grotesque-font">
        dyson
      </span>
    </div>
  );
}

export function SkeletonLabel({ className = "" }) {
  return <div className={`skeleton h-2 w-20 ${className}`} />;
}

export function SkeletonHeading({ className = "" }) {
  return <div className={`skeleton h-8 w-3/4 ${className}`} />;
}
