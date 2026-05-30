import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Play, CheckCircle2, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AdminPageHeader,
  AdminCard,
  AdminKpiCard,
  AdminKpiSkeleton,
  AdminSkeleton,
  StatusPill,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import {
  fetchWorkoutAnalytics,
  fetchExerciseUsage,
  fetchUserGrowth,
  fetchAdminKpis,
} from "@/services/admin.service";
import { muscleLabel, fmtNumber, shortDay } from "@/lib/adminData";

const tip = {
  contentStyle: { background: "hsl(140 8% 9%)", border: "1px solid hsl(140 6% 18%)", borderRadius: 12, fontSize: 12 },
};

export default function AdminAnalytics() {
  const analyticsQ = useQuery({ queryKey: ["admin", "workout-analytics"], queryFn: fetchWorkoutAnalytics });
  const kpisQ = useQuery({ queryKey: ["admin", "kpis"], queryFn: fetchAdminKpis });
  const mostQ = useQuery({ queryKey: ["admin", "ex-most"], queryFn: () => fetchExerciseUsage(false, 5) });
  const leastQ = useQuery({ queryKey: ["admin", "ex-least"], queryFn: () => fetchExerciseUsage(true, 5) });
  const growthQ = useQuery({ queryKey: ["admin", "growth"], queryFn: () => fetchUserGrowth(30) });

  const a = analyticsQ.data;
  const k = kpisQ.data;
  const completionRate = a && a.started > 0 ? Math.round((a.finished / a.started) * 100) : 0;
  const conversionRate =
    k && k.totalUsers > 0 ? ((k.activeSubscribers / k.totalUsers) * 100).toFixed(1) : "0";

  return (
    <div>
      <AdminPageHeader title="Analytics" subtitle="Comportamento e engajamento da base" />

      {analyticsQ.isLoading || kpisQ.isLoading ? (
        <AdminKpiSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <AdminKpiCard label="Treinos iniciados (30d)" value={fmtNumber(a?.started ?? 0)} icon={<Play className="h-4 w-4" />} />
          <AdminKpiCard label="Treinos concluídos (30d)" value={fmtNumber(a?.finished ?? 0)} icon={<CheckCircle2 className="h-4 w-4" />} />
          <AdminKpiCard label="Taxa de conclusão" value={`${completionRate}%`} icon={<Activity className="h-4 w-4" />} />
          <AdminKpiCard label="Tempo médio por treino" value={`${a?.avgMinutes ?? 0}min`} icon={<Clock className="h-4 w-4" />} />
          <AdminKpiCard label="Usuários ativos" value={fmtNumber(k?.activeUsers ?? 0)} icon={<Activity className="h-4 w-4" />} />
          <AdminKpiCard label="Conversão p/ assinante" value={`${conversionRate}%`} icon={<ArrowUpRight className="h-4 w-4" />} />
        </div>
      )}

      <AdminCard title="Novos usuários" subtitle="Aquisição diária — 30 dias" className="mt-4">
        {growthQ.isLoading ? (
          <AdminSkeleton className="h-64" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(growthQ.data ?? []).map((d) => ({ label: shortDay(d.day), novos: d.novos }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tip} cursor={{ fill: "hsl(140 6% 12%)" }} />
                <Bar dataKey="novos" name="Novos" fill="hsl(120 75% 55%)" radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </AdminCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Exercícios mais usados">
          {mostQ.isLoading ? (
            <AdminSkeleton className="h-48" />
          ) : (mostQ.data ?? []).length === 0 ? (
            <AdminEmptyState title="Sem dados de uso ainda" />
          ) : (
            <ol className="space-y-2">
              {(mostQ.data ?? []).map((e, i) => (
                <li key={e.exerciseId} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{muscleLabel[e.muscleGroup] ?? e.muscleGroup}</p>
                  </div>
                  <StatusPill tone="success">{fmtNumber(e.uses)} usos</StatusPill>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>

        <AdminCard title="Exercícios menos usados">
          {leastQ.isLoading ? (
            <AdminSkeleton className="h-48" />
          ) : (leastQ.data ?? []).length === 0 ? (
            <AdminEmptyState title="Sem dados de uso ainda" />
          ) : (
            <ol className="space-y-2">
              {(leastQ.data ?? []).map((e, i) => (
                <li key={e.exerciseId} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{muscleLabel[e.muscleGroup] ?? e.muscleGroup}</p>
                  </div>
                  <StatusPill tone="muted">{fmtNumber(e.uses)} usos</StatusPill>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
