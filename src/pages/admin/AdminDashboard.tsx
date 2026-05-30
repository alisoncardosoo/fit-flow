import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Users as UsersIcon,
  UserCheck,
  UserPlus,
  CreditCard,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AdminPageHeader,
  AdminKpiCard,
  AdminCard,
  AdminKpiSkeleton,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import {
  fetchAdminKpis,
  fetchUserGrowth,
  fetchRevenueMonthly,
  fetchPlanDistribution,
  fetchEngagementHeatmap,
} from "@/services/admin.service";
import {
  fmtCents,
  fmtNumber,
  fmtCurrency,
  shortDay,
  shortMonth,
  weekdayLabels,
  planLabel,
} from "@/lib/adminData";

const PLAN_COLORS = ["hsl(140 6% 30%)", "hsl(88 100% 76%)", "hsl(120 75% 55%)"];

const tip = {
  contentStyle: { background: "hsl(140 8% 9%)", border: "1px solid hsl(140 6% 18%)", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "hsl(80 15% 90%)" },
  itemStyle: { color: "hsl(80 15% 90%)" },
};

export default function AdminDashboard() {
  const kpisQ = useQuery({ queryKey: ["admin", "kpis"], queryFn: fetchAdminKpis });
  const growthQ = useQuery({ queryKey: ["admin", "growth"], queryFn: () => fetchUserGrowth(30) });
  const revenueQ = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => fetchRevenueMonthly(12) });
  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: fetchPlanDistribution });
  const heatQ = useQuery({ queryKey: ["admin", "heatmap"], queryFn: () => fetchEngagementHeatmap(90) });

  const k = kpisQ.data;
  const growth = growthQ.data ?? [];
  const growthSpark = growth.map((d) => d.total);

  const kpis = k
    ? [
        { label: "Usuários totais", value: fmtNumber(k.totalUsers), icon: <UsersIcon className="h-4 w-4" />, spark: growthSpark },
        { label: "Usuários ativos", value: fmtNumber(k.activeUsers), icon: <UserCheck className="h-4 w-4" />, spark: growthSpark.map((v) => Math.round(v * 0.7)) },
        { label: "Novos hoje", value: fmtNumber(k.newToday), icon: <UserPlus className="h-4 w-4" />, spark: growth.map((d) => d.novos) },
        { label: "Assinantes ativos", value: fmtNumber(k.activeSubscribers), icon: <CreditCard className="h-4 w-4" /> },
        { label: "Receita mensal (MRR)", value: fmtCents(k.mrrCents), icon: <DollarSign className="h-4 w-4" /> },
        { label: "Receita anual (ARR)", value: fmtCents(k.arrCents), icon: <TrendingUp className="h-4 w-4" /> },
      ]
    : [];

  // Monta a matriz do heatmap [dow][hour] a partir das células retornadas.
  const heatCells = heatQ.data ?? [];
  const heatGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  heatCells.forEach((c) => {
    if (c.dow >= 0 && c.dow < 7 && c.hour >= 0 && c.hour < 24) heatGrid[c.dow][c.hour] = c.sessions;
  });
  const heatMax = Math.max(1, ...heatCells.map((c) => c.sessions));

  const planData = (plansQ.data ?? []).map((p) => ({ name: planLabel[p.code] ?? p.name, value: p.total, key: p.code }));

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Visão geral do negócio em tempo real"
      />

      {/* KPIs */}
      {kpisQ.isLoading ? (
        <AdminKpiSkeleton count={6} />
      ) : kpisQ.isError ? (
        <AdminCard><AdminErrorState message={(kpisQ.error as Error)?.message} onRetry={() => kpisQ.refetch()} /></AdminCard>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <AdminKpiCard label={kpi.label} value={kpi.value} delta={0} icon={kpi.icon} spark={kpi.spark} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AdminCard title="Crescimento de usuários" subtitle="Últimos 30 dias" className="lg:col-span-2">
          {growthQ.isLoading ? (
            <AdminSkeleton className="h-64" />
          ) : growth.length === 0 ? (
            <AdminEmptyState title="Sem dados de crescimento ainda" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth.map((d) => ({ ...d, label: shortDay(d.day) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(88 100% 76%)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(88 100% 76%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip {...tip} formatter={(v) => fmtNumber(Number(v))} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="hsl(88 100% 76%)" strokeWidth={2.5} fill="url(#growthFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Assinaturas" subtitle="Distribuição por plano">
          {plansQ.isLoading ? (
            <AdminSkeleton className="h-64" />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie data={planData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                    {planData.map((_, i) => (
                      <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tip} formatter={(v) => `${v} usuários`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3">
                {planData.map((p, i) => (
                  <div key={p.key} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="font-semibold">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminCard>
      </div>

      {/* Charts row 2 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Receita" subtitle="Mensal (últimos 12 meses)">
          {revenueQ.isLoading ? (
            <AdminSkeleton className="h-64" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(revenueQ.data ?? []).map((r) => ({ mes: shortMonth(r.month), receita: r.revenueCents / 100 }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip {...tip} formatter={(v) => fmtCurrency(Number(v))} cursor={{ fill: "hsl(140 6% 12%)" }} />
                  <Bar dataKey="receita" name="Receita" fill="hsl(88 100% 76%)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Engajamento" subtitle="Heatmap de sessões por dia e horário">
          {heatQ.isLoading ? (
            <AdminSkeleton className="h-64" />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[460px]">
                <div className="mb-1 flex pl-9 text-[10px] text-muted-foreground">
                  {[0, 6, 12, 18, 23].map((h) => (
                    <span key={h} style={{ width: h === 23 ? "auto" : `${(6 / 24) * 100}%` }}>{h}h</span>
                  ))}
                </div>
                {heatGrid.map((row, d) => (
                  <div key={d} className="mb-1 flex items-center gap-1">
                    <span className="w-8 text-[10px] text-muted-foreground">{weekdayLabels[d]}</span>
                    <div className="flex flex-1 gap-[2px]">
                      {row.map((val, h) => {
                        const intensity = val / heatMax;
                        return (
                          <div
                            key={h}
                            title={`${weekdayLabels[d]} ${h}h — ${val} sessões`}
                            className="h-4 flex-1 rounded-[3px]"
                            style={{ background: intensity < 0.05 ? "hsl(140 6% 13%)" : `hsl(88 100% 76% / ${0.15 + intensity * 0.85})` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
