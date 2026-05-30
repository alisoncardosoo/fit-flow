import { motion } from "framer-motion";
import {
  Users as UsersIcon,
  UserCheck,
  UserPlus,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Download,
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
import { Button } from "@/components/ui/button";
import { AdminPageHeader, AdminKpiCard, AdminCard } from "@/components/admin/AdminUI";
import {
  getKpis,
  userGrowth,
  revenueMonthly,
  planDistribution,
  engagementHeatmap,
  weekdayLabels,
  fmtCurrency,
  fmtNumber,
} from "@/lib/adminData";

const PLAN_COLORS = ["hsl(140 6% 30%)", "hsl(88 100% 76%)", "hsl(120 75% 55%)"];

function chartTooltip(formatter?: (v: number | string) => string) {
  return {
    contentStyle: {
      background: "hsl(140 8% 9%)",
      border: "1px solid hsl(140 6% 18%)",
      borderRadius: 12,
      fontSize: 12,
    },
    labelStyle: { color: "hsl(80 15% 90%)" },
    itemStyle: { color: "hsl(80 15% 90%)" },
    formatter,
  };
}

export default function AdminDashboard() {
  const k = getKpis();
  const growthSpark = userGrowth.map((d) => d.total);
  const revSpark = revenueMonthly.map((d) => d.receita);

  const kpis: {
    label: string;
    value: string;
    delta: number;
    icon: JSX.Element;
    spark: number[];
    invert?: boolean;
  }[] = [
    { label: "Usuários totais", value: fmtNumber(k.total.value), delta: k.total.delta, icon: <UsersIcon className="h-4 w-4" />, spark: growthSpark },
    { label: "Usuários ativos", value: fmtNumber(k.active.value), delta: k.active.delta, icon: <UserCheck className="h-4 w-4" />, spark: growthSpark.map((v) => v * 0.7) },
    { label: "Novos hoje", value: fmtNumber(k.newToday.value), delta: k.newToday.delta, icon: <UserPlus className="h-4 w-4" />, spark: userGrowth.map((d) => d.novos) },
    { label: "Assinantes ativos", value: fmtNumber(k.subscribers.value), delta: k.subscribers.delta, icon: <CreditCard className="h-4 w-4" />, spark: revSpark },
    { label: "Receita mensal (MRR)", value: fmtCurrency(k.mrr.value), delta: k.mrr.delta, icon: <DollarSign className="h-4 w-4" />, spark: revSpark },
    { label: "Receita anual (ARR)", value: fmtCurrency(k.arr.value), delta: k.arr.delta, icon: <TrendingUp className="h-4 w-4" />, spark: revSpark },
    { label: "Churn", value: `${k.churn.value}%`, delta: k.churn.delta, icon: <TrendingDown className="h-4 w-4" />, invert: true, spark: [4.6, 4.2, 4.0, 3.9, 3.7, 3.5, 3.4] },
    { label: "Taxa de retenção", value: `${k.retention.value}%`, delta: k.retention.delta, icon: <Target className="h-4 w-4" />, spark: [72, 73, 74, 75, 76, 77, 78.5] },
  ];

  const heatMax = Math.max(...engagementHeatmap.flat());

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Visão geral do negócio — 30 de maio de 2026"
        actions={
          <Button variant="outline" className="h-10 gap-1.5 rounded-xl border-border">
            <Download className="h-4 w-4" /> Exportar relatório
          </Button>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <AdminKpiCard
              label={kpi.label}
              value={kpi.value}
              delta={kpi.delta}
              icon={kpi.icon}
              spark={kpi.spark}
              invertDelta={kpi.invert}
            />
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AdminCard
          title="Crescimento de usuários"
          subtitle="Últimos 30 dias"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(88 100% 76%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(88 100% 76%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip {...chartTooltip((v) => fmtNumber(Number(v)))} />
                <Area type="monotone" dataKey="total" name="Total" stroke="hsl(88 100% 76%)" strokeWidth={2.5} fill="url(#growthFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Assinaturas" subtitle="Distribuição por plano">
          <div className="flex h-64 flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  stroke="none"
                >
                  {planDistribution.map((_, i) => (
                    <Cell key={i} fill={PLAN_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltip((v) => `${v} usuários`)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3">
              {planDistribution.map((p, i) => (
                <div key={p.key} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[i] }} />
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="font-semibold">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Charts row 2 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Receita" subtitle="Mensal — receita vs meta">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueMonthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip {...chartTooltip((v) => fmtCurrency(Number(v)))} cursor={{ fill: "hsl(140 6% 12%)" }} />
                <Bar dataKey="meta" name="Meta" fill="hsl(140 6% 22%)" radius={[6, 6, 0, 0]} maxBarSize={18} />
                <Bar dataKey="receita" name="Receita" fill="hsl(88 100% 76%)" radius={[6, 6, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Engajamento" subtitle="Heatmap de uso por dia e horário">
          <div className="overflow-x-auto">
            <div className="min-w-[460px]">
              {/* Hour axis */}
              <div className="mb-1 flex pl-9">
                {[0, 6, 12, 18, 23].map((h) => (
                  <span
                    key={h}
                    className="text-[10px] text-muted-foreground"
                    style={{ width: h === 23 ? "auto" : `${(6 / 24) * 100}%` }}
                  >
                    {h}h
                  </span>
                ))}
              </div>
              {engagementHeatmap.map((row, d) => (
                <div key={d} className="mb-1 flex items-center gap-1">
                  <span className="w-8 text-[10px] text-muted-foreground">{weekdayLabels[d]}</span>
                  <div className="flex flex-1 gap-[2px]">
                    {row.map((val, h) => {
                      const intensity = val / heatMax;
                      return (
                        <div
                          key={h}
                          title={`${weekdayLabels[d]} ${h}h — ${val}`}
                          className="h-4 flex-1 rounded-[3px]"
                          style={{
                            background:
                              intensity < 0.05
                                ? "hsl(140 6% 13%)"
                                : `hsl(88 100% 76% / ${0.15 + intensity * 0.85})`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                Menos
                <span className="h-3 w-3 rounded-[3px]" style={{ background: "hsl(140 6% 13%)" }} />
                <span className="h-3 w-3 rounded-[3px]" style={{ background: "hsl(88 100% 76% / 0.4)" }} />
                <span className="h-3 w-3 rounded-[3px]" style={{ background: "hsl(88 100% 76% / 0.7)" }} />
                <span className="h-3 w-3 rounded-[3px]" style={{ background: "hsl(88 100% 76%)" }} />
                Mais
              </div>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
