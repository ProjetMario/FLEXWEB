"use client";

export function SimpleLineChart({
  data,
  lines,
  height = 200,
}: {
  data: { date: string }[];
  lines: { key: string; color: string }[];
  height?: number;
}) {
  if (data.length === 0) return null;

  const allValues = data.flatMap((d) => lines.map((l) => Number(d[l.key as keyof typeof d])));
  const max = Math.max(1, ...allValues);
  const width = data.length * 24;

  function smoothPath(key: string) {
    const pts = data.map((d, i) => {
      const x = i * 24 + 12;
      const value = Number(d[key as keyof typeof d]);
      const y = height - (value / max) * (height - 20) - 10;
      return { x, y };
    });

    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const mx = (curr.x + next.x) / 2;
      d += ` Q ${curr.x} ${curr.y}, ${mx} ${(curr.y + next.y) / 2}`;
    }
    const last = pts[pts.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} height={height} className="min-w-full" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 5 }).map((_, i) => {
          const y = (height - 20) * (i / 4) + 10;
          return (
            <line key={i} x1="0" y1={y} x2={width} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
          );
        })}
        {lines.map((line) => (
          <path
            key={line.key}
            d={smoothPath(line.key)}
            fill="none"
            stroke={line.color}
            strokeWidth="2"
          />
        ))}
        {data.map((d, i) => (
          <text key={i} x={i * 24 + 12} y={height - 2} textAnchor="middle" fontSize="8" fill="#94a3b8">
            {d.date}
          </text>
        ))}
      </svg>
    </div>
  );
}
