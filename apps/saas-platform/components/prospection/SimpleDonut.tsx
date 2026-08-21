"use client";

export function SimpleDonut({
  items,
  total,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
}) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const data = total > 0 ? items.map((item, i) => {
    const share = item.value / total;
    const offset = items.slice(0, i).reduce((sum, it) => sum + (it.value / total) * circumference, 0);
    return { ...item, share, offset };
  }) : [];

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
          {data.map((item, i) => {
            const dash = item.share * circumference;
            return (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth="12"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-item.offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-slate-500">Total</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-600">{item.label}</span>
            <span className="ml-auto font-medium">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
