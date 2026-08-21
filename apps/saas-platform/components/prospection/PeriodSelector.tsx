"use client";

import { CalendarDays } from "lucide-react";

type StatsPeriod = "today" | "week" | "month" | "30days" | "all";

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  "30days": "30 derniers jours",
  all: "Tous les temps",
};

export function PeriodSelector({
  period,
  labels = PERIOD_LABELS,
}: {
  period: StatsPeriod;
  labels?: Record<StatsPeriod, string>;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-800">
        <CalendarDays className="h-4 w-4 text-slate-500" />
        <select
          value={period}
          onChange={(e) => {
            const value = e.target.value;
            const url = new URL(window.location.href);
            url.searchParams.set("period", value);
            window.location.href = url.toString();
          }}
          className="bg-transparent text-sm font-medium outline-none"
        >
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
