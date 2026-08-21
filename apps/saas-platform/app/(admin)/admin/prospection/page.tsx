import Link from "next/link";
import { requireAdmin } from "@/lib/prospection/auth";
import {
  getDashboardStats,
  getPipelineStats,
  getStatusDistribution,
  getRecentActivity,
  getActionsToday,
  getEvolutionData,
  type StatsPeriod,
  STATUS_LABELS,
} from "@/lib/prospection/dashboard-stats";
import { PeriodSelector } from "@/components/prospection/PeriodSelector";
import { SimpleDonut } from "@/components/prospection/SimpleDonut";
import { SimpleLineChart } from "@/components/prospection/SimpleLineChart";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Users,
  MessageSquare,
  MessageCircle,
  CalendarCheck,
  UserCheck,
  Wallet,
  ArrowUpRight,
  ChevronRight,
  Plus,
  CheckCircle,
  Phone,
  FileText,
  RotateCcw,
} from "lucide-react";
import { ProspectStatusBadge } from "@/components/prospection/ProspectStatusBadge";

const statusColors: Record<string, string> = {
  A_CONTACTER: "#3b82f6",
  SMS_ENVOYE: "#0ea5e9",
  REPONDU: "#6366f1",
  INTERESSE: "#22c55e",
  RDV_PLANIFIE: "#14b8a6",
  DEVIS_ENVOYE: "#06b6d4",
  CLIENT_SIGNE: "#10b981",
  SANS_REPONSE: "#f59e0b",
  A_RELANCER: "#f97316",
  PERDU: "#ef4444",
  PAS_INTERESSE: "#64748b",
  NOUVEAU: "#94a3b8",
};

const statsConfig = [
  { key: "totalProspects", label: "Prospects", sub: "Total dans la base", icon: Users, color: "bg-blue-500" },
  { key: "smsSent", label: "SMS envoyés", sub: "Sur la période", icon: MessageSquare, color: "bg-indigo-500" },
  { key: "replied", label: "Réponses", sub: "Taux de réponse", icon: MessageCircle, color: "bg-emerald-500" },
  { key: "appointments", label: "Rendez-vous", sub: "Taux RDV", icon: CalendarCheck, color: "bg-violet-500" },
  { key: "signedClients", label: "Clients signés", sub: "Taux conversion", icon: UserCheck, color: "bg-green-500" },
  { key: "mrr", label: "MRR généré", sub: "Revenu récurrent / mois", icon: Wallet, color: "bg-amber-500", format: (v: number) => `${v.toLocaleString("fr-FR")} €` },
];

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <ArrowUpRight className="h-3.5 w-3.5" /> {trend}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default async function ProspectionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const period = (params.period as StatsPeriod) || "30days";

  const [stats, pipeline, distribution, activities, actions, evolution] = await Promise.all([
    getDashboardStats(period),
    getPipelineStats(),
    getStatusDistribution(),
    getRecentActivity(8),
    getActionsToday(),
    getEvolutionData(30),
  ]);

  const donutItems = distribution
    .filter((d) => d.count > 0)
    .slice(0, 7)
    .map((d) => ({ label: STATUS_LABELS[d.status], value: d.count, color: statusColors[d.status] || "#64748b" }));

  const total = distribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour Flex-Web 👋</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Voici un aperçu de la prospection aujourd&apos;hui.</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector period={period} />
          <Link href="/admin/prospection/prospects/new" className={cn(buttonVariants({ variant: "default" }))}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau prospect
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statsConfig.map((config) => (
          <StatCard
            key={config.key}
            label={config.label}
            value={
              config.format
                ? config.format(stats[config.key as keyof typeof stats] as number)
                : (stats[config.key as keyof typeof stats] as string | number)
            }
            sub={config.sub}
            icon={config.icon}
            color={config.color}
            trend={config.key === "smsSent" ? "+15%" : config.key === "replied" ? "+27%" : undefined}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Actions aujourd&apos;hui</h2>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                {actions.reduce((s, a) => s + a.value, 0)}
              </span>
            </div>
            <ul className="space-y-3">
              {actions.map((action, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {i === 0 ? <Users className="h-4 w-4 text-blue-600" /> : i === 1 ? <RotateCcw className="h-4 w-4 text-orange-600" /> : <CalendarCheck className="h-4 w-4 text-green-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {action.value} {action.label.toLowerCase()}
                    </p>
                    <p className="text-xs text-slate-500">{action.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </li>
              ))}
            </ul>
            <Link href="/admin/prospection/prospects" className={cn(buttonVariants({ variant: "default" }), "mt-4 w-full justify-center")}>
              Commencer ma prospection <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold">Performance ce mois</h2>
            <div className="mt-4 space-y-4">
              <MetricRow label="SMS envoyés" value={stats.smsSent} target={100} color="bg-blue-500" />
              <MetricRow label="Réponses" value={stats.replied} target={Math.round(stats.smsSent * 0.3)} color="bg-emerald-500" />
              <MetricRow label="Intéressés" value={stats.interested} target={Math.round(stats.smsSent * 0.15)} color="bg-amber-500" />
              <MetricRow label="Rendez-vous" value={stats.appointments} target={Math.round(stats.smsSent * 0.08)} color="bg-violet-500" />
              <MetricRow label="Devis envoyés" value={stats.quotesSent} target={Math.round(stats.smsSent * 0.05)} color="bg-cyan-500" />
              <MetricRow label="Clients signés" value={stats.signedClients} target={Math.round(stats.smsSent * 0.03)} color="bg-green-500" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Pipeline</h2>
              <Link href="/admin/prospection/prospects" className="text-sm text-blue-600 hover:underline">
                Voir tout le pipeline
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {pipeline.map((p) => (
                <div key={p.status} className="rounded-xl border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-xs font-medium text-slate-500">{STATUS_LABELS[p.status]}</p>
                  <p className="mt-1 text-xl font-bold">{p.count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold">Activité récente</h2>
              <ul className="mt-4 space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      {a.type === "SMS_ENVOYE" ? <MessageSquare className="h-4 w-4 text-blue-600" /> :
                       a.type === "REPONSE_RECUE" ? <MessageCircle className="h-4 w-4 text-emerald-600" /> :
                       a.type === "RDV" ? <CalendarCheck className="h-4 w-4 text-violet-600" /> :
                       a.type === "CLIENT_SIGNE" ? <UserCheck className="h-4 w-4 text-green-600" /> :
                       a.type === "DEVIS" ? <FileText className="h-4 w-4 text-cyan-600" /> :
                       a.type === "APPEL" ? <Phone className="h-4 w-4 text-amber-600" /> :
                       <CheckCircle className="h-4 w-4 text-slate-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {a.type === "STATUT_MODIFIE" && a.newStatus ? (
                          <span className="flex flex-wrap items-center gap-1">
                            {a.prospect.companyName} — changement de statut <ProspectStatusBadge status={a.newStatus} />
                          </span>
                        ) : (
                          `${a.type.replace("_", " ").toLowerCase()} : ${a.prospect.companyName}`
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString("fr-FR")}</p>
                    </div>
                  </li>
                ))}
                {activities.length === 0 && <p className="text-sm text-slate-500">Aucune activité récente.</p>}
              </ul>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold">Répartition des statuts</h2>
              <div className="mt-4 flex justify-center">
                <SimpleDonut items={donutItems} total={total} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Évolution</h2>
              <select className="rounded-md border bg-transparent px-2 py-1 text-sm dark:border-slate-800">
                <option>30 derniers jours</option>
              </select>
            </div>
            <SimpleLineChart
              data={evolution}
              lines={[
                { key: "sms", color: "#3b82f6" },
                { key: "replies", color: "#22c55e" },
                { key: "appointments", color: "#8b5cf6" },
                { key: "clients", color: "#10b981" },
              ]}
              height={220}
            />
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">CA & MRR</h2>
              <select className="rounded-md border bg-transparent px-2 py-1 text-sm dark:border-slate-800">
                <option>Ce mois</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
                <p className="text-xs text-slate-500">CA ponctuel (mise en service)</p>
                <p className="mt-1 text-2xl font-bold">{stats.signedRevenue.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-emerald-600">+ 35% vs mois précédent</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
                <p className="text-xs text-slate-500">MRR généré</p>
                <p className="mt-1 text-2xl font-bold">{stats.mrr.toLocaleString("fr-FR")} € / mois</p>
                <p className="text-xs text-emerald-600">+ 63% vs mois précédent</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
                <p className="text-xs text-slate-500">Valeur du portefeuille</p>
                <p className="mt-1 text-2xl font-bold">{stats.estimatedPipeline.toLocaleString("fr-FR")} €</p>
                <p className="text-xs text-slate-500">Potentiel des devis en cours</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
                <p className="text-xs text-slate-500">Valeur annuelle des abonnements</p>
                <p className="mt-1 text-2xl font-bold">{(stats.mrr * 12).toLocaleString("fr-FR")} € / an</p>
                <p className="text-xs text-slate-500">Si tout est signé</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">
          {value} <span className="text-slate-400">/ {target}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
