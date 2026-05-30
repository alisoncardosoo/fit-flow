import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Activity, Clock, Play, CheckCircle2, ArrowUpRight } from "lucide-react";
import { AdminPageHeader, AdminCard, AdminKpiCard, StatusPill } from "@/components/admin/AdminUI";
import {
  userGrowth,
  categoryLabel,
  exercises,
  muscleLabel,
  fmtNumber,
  type WorkoutCategory,
} from "@/lib/adminData";

const retentionCohort = [
  { semana: "S0", retencao: 100 },
  { semana: "S1", retencao: 68 },
  { semana: "S2", retencao: 52 },
  { semana: "S3", retencao: 44 },
  { semana: "S4", retencao: 39 },
  { semana: "S6", retencao: 33 },
  { semana: "S8", retencao: 29 },
];

const sessionsByDay = [
  { dia: "Seg", sessoes: 1820 },
  { dia: "Ter", sessoes: 2010 },
  { dia: "Qua", sessoes: 1940 },
  { dia: "Qui", sessoes: 2180 },
  { dia: "Sex", sessoes: 1760 },
  { dia: "Sáb", sessoes: 980 },
  { dia: "Dom", sessoes: 740 },
];

const topCategories: { cat: WorkoutCategory; pct: number }[] = [
  { cat: "hypertrophy", pct: 38 },
  { cat: "weight_loss", pct: 24 },
  { cat: "cardio", pct: 16 },
  { cat: "home", pct: 12 },
  { cat: "mobility", pct: 6 },
  { cat: "stretching", pct: 4 },
];

const tip = {
  contentStyle: { background: "hsl(140 8% 9%)", border: "1px solid hsl(140 6% 18%)", borderRadius: 12, fontSize: 12 },
};

export default function AdminAnalytics() {
  const mostUsed = [...exercises].sort((a, b) => b.uses - a.uses).slice(0, 5);
  const leastUsed = [...exercises].sort((a, b) => a.uses - b.uses).slice(0, 5);

  return (
    <div>
      <AdminPageHeader title="Analytics" subtitle="Comportamento e engajamento da base" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <AdminKpiCard label="Treinos iniciados (30d)" value="48.920" delta={6.2} icon={<Play className="h-4 w-4" />} />
        <AdminKpiCard label="Treinos concluídos (30d)" value="39.140" delta={5.1} icon={<CheckCircle2 className="h-4 w-4" />} />
        <AdminKpiCard label="Taxa de conclusão" value="80%" delta={1.4} icon={<Activity className="h-4 w-4" />} />
        <AdminKpiCard label="Tempo médio por treino" value="42min" delta={2.1} icon={<Clock className="h-4 w-4" />} />
        <AdminKpiCard label="DAU / MAU" value="42%" delta={3.4} icon={<Activity className="h-4 w-4" />} />
        <AdminKpiCard label="Conversão Free → Premium" value="6.8%" delta={4.5} icon={<ArrowUpRight className="h-4 w-4" />} />
      </div>

      {/* Conversion funnel */}
      <AdminCard title="Funil de conversão" subtitle="Gratuito → Premium" className="mt-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { stage: "Cadastros", value: 5740, pct: 100 },
            { stage: "Ativaram conta", value: 4310, pct: 75 },
            { stage: "Iniciaram trial", value: 1290, pct: 22 },
            { stage: "Viraram Premium", value: 390, pct: 6.8 },
          ].map((f, i) => (
            <div key={f.stage} className="rounded-xl border border-border/60 bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">{f.stage}</p>
              <p className="mt-1 font-display text-xl font-bold tracking-tight">{fmtNumber(f.value)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${f.pct}%`, background: i === 3 ? "hsl(88 100% 76%)" : "hsl(120 75% 55%)" }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-muted-foreground">{f.pct}%</p>
            </div>
          ))}
        </div>
      </AdminCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Retenção por coorte" subtitle="% de usuários ativos por semana">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionCohort} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="semana" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={40} unit="%" />
                <Tooltip {...tip} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="retencao" name="Retenção" stroke="hsl(88 100% 76%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(88 100% 76%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Sessões por dia da semana">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionsByDay} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip {...tip} cursor={{ fill: "hsl(140 6% 12%)" }} />
                <Bar dataKey="sessoes" name="Sessões" fill="hsl(88 100% 76%)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Novos usuários" subtitle="Aquisição diária — 30 dias">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userGrowth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip {...tip} cursor={{ fill: "hsl(140 6% 12%)" }} />
                <Bar dataKey="novos" name="Novos" fill="hsl(120 75% 55%)" radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Categorias mais treinadas">
          <div className="space-y-3 pt-1">
            {topCategories.map((c) => (
              <div key={c.cat}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{categoryLabel[c.cat]}</span>
                  <span className="text-muted-foreground">{c.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      {/* Exercise usage */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Exercícios mais usados">
          <ol className="space-y-2">
            {mostUsed.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{muscleLabel[e.muscle]}</p>
                </div>
                <StatusPill tone="success">{fmtNumber(e.uses)} usos</StatusPill>
              </li>
            ))}
          </ol>
        </AdminCard>

        <AdminCard title="Exercícios menos usados">
          <ol className="space-y-2">
            {leastUsed.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{muscleLabel[e.muscle]}</p>
                </div>
                <StatusPill tone="muted">{fmtNumber(e.uses)} usos</StatusPill>
              </li>
            ))}
          </ol>
        </AdminCard>
      </div>
    </div>
  );
}
