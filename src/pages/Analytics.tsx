import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar,
  PieChart, Pie, Cell, CartesianGrid, LineChart, Line,
} from "recharts";
import {
  Activity, Dumbbell, Flame, TrendingUp, TrendingDown, Minus, Zap,
  Trophy, Target, AlertTriangle, Sparkles, Clock, Calendar, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { AIInsightsCard } from "@/components/AIInsightsCard";
import {
  performanceScore, loadEvolution, weeklyFrequencyPct, performanceTrend,
  comparePeriods, personalRecords, generateInsights, alerts,
  type SetRow, type SessionRow,
} from "@/lib/analytics";
import { format, subDays, startOfWeek, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = 7 | 30 | 90;

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyTarget, setWeeklyTarget] = useState(4);
  const [period, setPeriod] = useState<Period>(30);
  const [selectedExId, setSelectedExId] = useState<string | null>(null);

  useEffect(() => { if (user) void load(); }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const since = subDays(new Date(), 90).toISOString();
    const [{ data: s }, { data: ss }, { data: streakData }, { data: prof }] = await Promise.all([
      supabase.from("set_logs")
        .select("weight, reps, completed_at, exercise_id, exercises(name, muscle_group)")
        .gte("completed_at", since).order("completed_at"),
      supabase.from("workout_sessions")
        .select("started_at, total_volume, duration_seconds")
        .not("finished_at", "is", null)
        .gte("started_at", since).order("started_at"),
      supabase.rpc("get_user_streak", { _user_id: user.id }),
      supabase.from("profiles").select("weekly_target").eq("user_id", user.id).maybeSingle(),
    ]);
    setSets((s as unknown as SetRow[]) ?? []);
    setSessions((ss as SessionRow[]) ?? []);
    setStreak(typeof streakData === "number" ? streakData : 0);
    setWeeklyTarget(prof?.weekly_target ?? 4);
    setLoading(false);
  }

  /* ---------- Filtered by period ---------- */
  const periodSets = useMemo(
    () => sets.filter((s) => differenceInDays(new Date(), new Date(s.completed_at)) <= period),
    [sets, period]
  );
  const periodSessions = useMemo(
    () => sessions.filter((s) => differenceInDays(new Date(), new Date(s.started_at)) <= period),
    [sessions, period]
  );

  /* ---------- KPIs ---------- */
  const evolutionPct = useMemo(() => loadEvolution(sets, 30), [sets]);
  const freqPct = useMemo(() => weeklyFrequencyPct(sessions, weeklyTarget), [sessions, weeklyTarget]);
  const score = useMemo(
    () => performanceScore({ sessions, weeklyTarget, loadEvolutionPct: evolutionPct, streak }),
    [sessions, weeklyTarget, evolutionPct, streak]
  );
  const trend = useMemo(() => performanceTrend(sets), [sets]);
  const dynamicMessage = useMemo(() => buildMessage(streak, evolutionPct, freqPct), [streak, evolutionPct, freqPct]);

  /* ---------- Comparação ---------- */
  const comparison = useMemo(() => comparePeriods(sessions, period), [sessions, period]);

  /* ---------- Recordes ---------- */
  const records = useMemo(() => personalRecords(sets), [sets]);

  /* ---------- Insights & alerts ---------- */
  const insights = useMemo(
    () => generateInsights({ sessions, sets, streak, weeklyTarget }),
    [sessions, sets, streak, weeklyTarget]
  );
  const alertList = useMemo(
    () => alerts({ sessions, loadEvolutionPct: evolutionPct, weeklyTarget }),
    [sessions, evolutionPct, weeklyTarget]
  );

  /* ---------- Exercise list for filter ---------- */
  const exercises = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of sets) {
      const ex = map.get(s.exercise_id);
      if (ex) ex.count++;
      else map.set(s.exercise_id, { id: s.exercise_id, name: s.exercises?.name ?? "?", count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [sets]);

  /* ---------- Chart data ---------- */
  const loadEvolutionData = useMemo(() => {
    const exId = selectedExId ?? exercises[0]?.id;
    if (!exId) return [];
    return periodSets
      .filter((s) => s.exercise_id === exId)
      .map((s) => ({
        date: format(new Date(s.completed_at), "dd/MM"),
        weight: Number(s.weight),
      }));
  }, [periodSets, selectedExId, exercises]);

  const volumeData = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const s of periodSessions) {
      const key = period === 7
        ? format(new Date(s.started_at), "EEE", { locale: ptBR })
        : format(startOfWeek(new Date(s.started_at), { weekStartsOn: 1 }), "dd/MM");
      buckets[key] = (buckets[key] ?? 0) + Number(s.total_volume ?? 0);
    }
    return Object.entries(buckets).map(([k, v]) => ({ k, volume: Math.round(v) }));
  }, [periodSessions, period]);

  const heatmap = useMemo(() => {
    const start = subDays(new Date(), 41);
    const days = eachDayOfInterval({ start, end: new Date() });
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      const k = format(new Date(s.started_at), "yyyy-MM-dd");
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return days.map((d) => ({ date: d, count: counts[format(d, "yyyy-MM-dd")] ?? 0 }));
  }, [sessions]);

  const muscleDist = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of periodSets) {
      const m = s.exercises?.muscle_group ?? "outro";
      acc[m] = (acc[m] ?? 0) + 1;
    }
    const total = Object.values(acc).reduce((a, b) => a + b, 0);
    return Object.entries(acc)
      .map(([name, value]) => ({ name: muscleLabel(name), value, pct: total ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [periodSets]);

  const durationData = useMemo(() => {
    return periodSessions.map((s) => ({
      date: format(new Date(s.started_at), "dd/MM"),
      min: Math.round((s.duration_seconds ?? 0) / 60),
    }));
  }, [periodSessions]);

  const COLORS = ["hsl(88 100% 76%)", "hsl(120 75% 55%)", "hsl(160 65% 50%)", "hsl(200 80% 60%)", "hsl(260 75% 65%)", "hsl(320 70% 60%)", "hsl(38 90% 60%)", "hsl(0 70% 60%)"];

  /* ---------- Render ---------- */
  if (loading) {
    return (
      <div className="px-5 safe-top space-y-4">
        <Skeleton className="h-16 w-1/2 rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-[28px]" />
        <Skeleton className="h-48 w-full rounded-[24px]" />
        <Skeleton className="h-48 w-full rounded-[24px]" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="px-5 safe-top">
        <PageHeader title="Progresso" subtitle="Suas métricas aparecerão aqui" />
        <div className="card-premium rounded-[28px] p-12 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Complete seu primeiro treino para ver suas estatísticas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 safe-top">
      <PageHeader
        eyebrow="Painel inteligente"
        title="Progresso"
        subtitle="Sua evolução, em tempo real"
      />

      {/* ===== HERO — Performance Score ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-hero mb-4 rounded-[28px] p-6"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="pill mb-3"><Zap className="h-3 w-3" /> Score de performance</span>
              <div className="flex items-baseline gap-2">
                <motion.span
                  key={score}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-display text-[64px] leading-[0.9] font-extrabold tracking-tight"
                >
                  {score}
                </motion.span>
                <span className="text-base font-bold text-foreground/60">/ 100</span>
              </div>
              <p className="mt-3 max-w-[260px] text-sm leading-snug text-foreground/85">{dynamicMessage}</p>
            </div>
            <ScoreRing value={score} />
          </div>

          {/* Mini KPIs */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniKpi
              icon={<Flame className="h-3.5 w-3.5" />}
              value={streak}
              label="Streak"
              suffix="d"
              tone={streak > 0 ? "warm" : "neutral"}
            />
            <MiniKpi
              icon={<Calendar className="h-3.5 w-3.5" />}
              value={freqPct}
              label="Frequência"
              suffix="%"
              tone="primary"
            />
            <MiniKpi
              icon={trend.trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : trend.trend === "down" ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
              value={`${evolutionPct >= 0 ? "+" : ""}${evolutionPct.toFixed(1)}`}
              label="Carga 30d"
              suffix="%"
              tone={trend.trend === "up" ? "success" : trend.trend === "down" ? "danger" : "neutral"}
            />
          </div>
        </div>
      </motion.div>

      {/* ===== ALERTS ===== */}
      <AnimatePresence>
        {alertList.map((a, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-3 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-4"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-sm">{a.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ===== PERIOD TABS ===== */}
      <div className="mb-4 flex gap-2">
        {([7, 30, 90] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${
              period === p
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}d
          </button>
        ))}
      </div>

      {/* ===== AI INSIGHTS (AI) ===== */}
      <AIInsightsCard />

      {/* ===== COMPARAÇÃO DE PERÍODOS ===== */}
      <ChartCard title={`vs. ${period} dias anteriores`} icon={<TrendingUp className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <CompareTile
            label="Treinos"
            current={comparison.sessionsCur}
            diff={comparison.sessionsDiff}
            previous={comparison.sessionsPrev}
          />
          <CompareTile
            label="Volume (kg)"
            current={comparison.volumeCur.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            diff={comparison.volumePct}
            previous={comparison.volumePrev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            isPercent
          />
        </div>
      </ChartCard>

      {/* ===== EVOLUÇÃO DE CARGA ===== */}
      {exercises.length > 0 && (
        <ChartCard
          title="Evolução de carga"
          icon={<Dumbbell className="h-4 w-4" />}
          extra={
            <ExerciseSelect
              exercises={exercises}
              value={selectedExId ?? exercises[0]?.id}
              onChange={setSelectedExId}
            />
          }
        >
          {loadEvolutionData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={loadEvolutionData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="weight" stroke="hsl(88 100% 76%)" strokeWidth={3} dot={{ r: 4, fill: "hsl(88 100% 76%)" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">Sem dados suficientes neste período</p>
          )}
        </ChartCard>
      )}

      {/* ===== VOLUME ===== */}
      {volumeData.length > 0 && (
        <ChartCard title="Volume de treino" icon={<Activity className="h-4 w-4" />}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(88 100% 76%)" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="hsl(88 100% 76%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="k" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="volume" stroke="hsl(88 100% 76%)" strokeWidth={2.5} fill="url(#vol)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ===== HEATMAP ===== */}
      <ChartCard title="Frequência — últimos 42 dias" icon={<Flame className="h-4 w-4" />}>
        <div className="grid grid-cols-7 gap-1.5">
          {heatmap.map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.005, 0.3) }}
              className="aspect-square rounded-lg"
              style={{
                background: d.count > 0
                  ? `hsl(88 100% ${82 - Math.min(d.count, 3) * 14}% / ${0.5 + d.count * 0.18})`
                  : "hsl(var(--secondary))",
              }}
              title={`${format(d.date, "dd/MM")}: ${d.count}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>Menos</span>
          {[0, 1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-3 w-3 rounded"
              style={{
                background: n === 0
                  ? "hsl(var(--secondary))"
                  : `hsl(88 100% ${82 - n * 14}% / ${0.5 + n * 0.18})`,
              }}
            />
          ))}
          <span>Mais</span>
        </div>
      </ChartCard>

      {/* ===== DISTRIBUIÇÃO MUSCULAR ===== */}
      {muscleDist.length > 0 && (
        <ChartCard title="Distribuição muscular" icon={<Target className="h-4 w-4" />}>
          <div className="grid grid-cols-[1fr,1.2fr] items-center gap-2">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={muscleDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={75} paddingAngle={3}>
                  {muscleDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {muscleDist.slice(0, 6).map((m, i) => (
                <div key={m.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="font-medium">{m.name}</span>
                  </div>
                  <span className="font-bold text-muted-foreground">{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      )}

      {/* ===== TEMPO DE TREINO ===== */}
      {durationData.length > 1 && (
        <ChartCard title="Duração das sessões" icon={<Clock className="h-4 w-4" />}>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={durationData}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="m" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v ?? 0)} min`, "Duração"]} />
              <Line type="monotone" dataKey="min" stroke="hsl(120 75% 55%)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ===== RECORDES ===== */}
      {records.length > 0 && (
        <ChartCard title="Recordes pessoais" icon={<Trophy className="h-4 w-4" />}>
          <div className="space-y-2">
            {records.map((r, i) => (
              <motion.div
                key={r.exercise + i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold ${
                  i === 0 ? "bg-primary text-primary-foreground shadow-glow" : "bg-primary/15 text-primary"
                }`}>
                  #{i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-bold">{r.exercise}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(r.date), "d 'de' MMM yyyy", { locale: ptBR })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-extrabold text-primary">{r.weight}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">kg</div>
                </div>
              </motion.div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* ===== INSIGHTS IA ===== */}
      {insights.length > 0 && (
        <ChartCard title="Insights" icon={<Sparkles className="h-4 w-4" />}>
          <div className="space-y-2">
            {insights.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed">{msg}</p>
              </motion.div>
            ))}
          </div>
        </ChartCard>
      )}

      <div className="h-8" />
    </div>
  );
}

/* ============================================================ */
/*                          SUB-COMPONENTS                       */
/* ============================================================ */

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 16,
  fontSize: 12,
};

function ScoreRing({ value }: { value: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--foreground) / 0.1)" strokeWidth="6" />
        <motion.circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 8px hsl(88 100% 76% / 0.6))" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-base font-extrabold">{value}%</span>
      </div>
    </div>
  );
}

function MiniKpi({
  icon, value, label, suffix, tone,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  suffix?: string;
  tone: "primary" | "success" | "danger" | "warm" | "neutral";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-destructive",
    warm: "text-warning",
    neutral: "text-foreground/70",
  }[tone];
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/30 p-3 backdrop-blur-md">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${toneClass}`}>
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-xl font-extrabold leading-none">
        {value}<span className="ml-0.5 text-xs font-bold text-foreground/60">{suffix}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, extra, children }: {
  title: string;
  icon: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      className="card-premium mb-4 rounded-[24px] p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </motion.div>
  );
}

function CompareTile({
  label, current, diff, previous, isPercent,
}: {
  label: string;
  current: number | string;
  diff: number;
  previous: number | string;
  isPercent?: boolean;
}) {
  const positive = diff > 0;
  const neutral = diff === 0;
  const tone = neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive";
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-2xl bg-secondary/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-extrabold">{current}</div>
      <div className={`mt-1 flex items-center gap-1 text-xs font-bold ${tone}`}>
        <Icon className="h-3 w-3" />
        {isPercent ? `${positive ? "+" : ""}${diff.toFixed(1)}%` : `${positive ? "+" : ""}${diff}`}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">antes: {previous}</div>
    </div>
  );
}

function ExerciseSelect({
  exercises, value, onChange,
}: {
  exercises: { id: string; name: string }[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full bg-secondary py-1.5 pl-3 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* ---------- helpers ---------- */
function muscleLabel(m: string): string {
  const map: Record<string, string> = {
    chest: "Peito", back: "Costas", shoulders: "Ombros", biceps: "Bíceps",
    triceps: "Tríceps", quads: "Quadríceps", hamstrings: "Posterior",
    glutes: "Glúteo", core: "Core", calves: "Panturrilha",
    forearms: "Antebraço", cardio: "Cardio", full_body: "Full body",
  };
  return map[m] ?? m;
}

function buildMessage(streak: number, evolutionPct: number, freqPct: number): string {
  if (evolutionPct > 8) return `Seu desempenho subiu ${evolutionPct.toFixed(1)}% nos últimos 30 dias 🔥`;
  if (streak >= 5) return `Você está consistente há ${streak} dias 🔥 continue!`;
  if (freqPct >= 100) return "Meta semanal batida. Você está no controle.";
  if (evolutionPct < -5) return "Sinais de queda — hora de ajustar a estratégia.";
  if (freqPct < 50) return "Vamos retomar o ritmo. Um treino por vez.";
  return "Mantém o foco. Cada série conta para sua evolução.";
}
