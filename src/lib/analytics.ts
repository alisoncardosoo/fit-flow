import { differenceInDays, startOfWeek, subDays } from "date-fns";

export type SetRow = {
  weight: number;
  reps: number;
  completed_at: string;
  exercise_id: string;
  exercises: { name: string; muscle_group: string } | null;
};

export type SessionRow = {
  started_at: string;
  total_volume: number | null;
  duration_seconds: number | null;
};

/* ---------- Score de Performance (0-100) ---------- */
export function performanceScore(args: {
  sessions: SessionRow[];
  weeklyTarget: number;
  loadEvolutionPct: number;
  streak: number;
}): number {
  const { sessions, weeklyTarget, loadEvolutionPct, streak } = args;

  // Frequency score (40 pts) — last 4 weeks vs target
  const last28 = sessions.filter((s) => differenceInDays(new Date(), new Date(s.started_at)) <= 28);
  const expected = weeklyTarget * 4;
  const freqScore = Math.min(40, (last28.length / Math.max(expected, 1)) * 40);

  // Evolution score (30 pts)
  const evoScore = Math.max(0, Math.min(30, 15 + loadEvolutionPct * 1.5));

  // Streak score (15 pts)
  const streakScore = Math.min(15, streak * 1.5);

  // Volume consistency (15 pts) — std dev penalty
  const vols = last28.map((s) => Number(s.total_volume ?? 0)).filter((v) => v > 0);
  const consistency = vols.length >= 3 ? 15 - Math.min(15, stdDev(vols) / (avg(vols) || 1) * 15) : 7;

  return Math.round(freqScore + evoScore + streakScore + consistency);
}

/* ---------- Evolução de carga (%) ---------- */
export function loadEvolution(sets: SetRow[], days = 30): number {
  if (sets.length < 2) return 0;
  const cutoff = subDays(new Date(), days);
  const half = subDays(new Date(), Math.floor(days / 2));

  const prev = sets.filter((s) => new Date(s.completed_at) >= cutoff && new Date(s.completed_at) < half);
  const curr = sets.filter((s) => new Date(s.completed_at) >= half);

  if (prev.length === 0 || curr.length === 0) return 0;
  const prevAvg = avg(prev.map((s) => Number(s.weight)));
  const currAvg = avg(curr.map((s) => Number(s.weight)));
  if (prevAvg === 0) return 0;
  return ((currAvg - prevAvg) / prevAvg) * 100;
}

/* ---------- Frequência semanal (%) ---------- */
export function weeklyFrequencyPct(sessions: SessionRow[], weeklyTarget: number): number {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekSessions = sessions.filter((s) => new Date(s.started_at) >= weekStart).length;
  return Math.min(100, Math.round((weekSessions / Math.max(weeklyTarget, 1)) * 100));
}

/* ---------- Tendência (evolução / platô / regressão) ---------- */
export type Trend = "up" | "flat" | "down";
export function performanceTrend(sets: SetRow[]): { trend: Trend; pct: number } {
  const pct = loadEvolution(sets, 30);
  if (pct > 3) return { trend: "up", pct };
  if (pct < -3) return { trend: "down", pct };
  return { trend: "flat", pct };
}

/* ---------- Comparação de períodos ---------- */
export function comparePeriods(sessions: SessionRow[], windowDays: number) {
  const now = new Date();
  const curStart = subDays(now, windowDays);
  const prevStart = subDays(now, windowDays * 2);

  const cur = sessions.filter((s) => new Date(s.started_at) >= curStart);
  const prev = sessions.filter((s) => {
    const d = new Date(s.started_at);
    return d >= prevStart && d < curStart;
  });

  const curVol = sum(cur.map((s) => Number(s.total_volume ?? 0)));
  const prevVol = sum(prev.map((s) => Number(s.total_volume ?? 0)));
  const volPct = prevVol === 0 ? (curVol > 0 ? 100 : 0) : ((curVol - prevVol) / prevVol) * 100;

  return {
    sessionsCur: cur.length,
    sessionsPrev: prev.length,
    sessionsDiff: cur.length - prev.length,
    volumeCur: curVol,
    volumePrev: prevVol,
    volumePct: volPct,
  };
}

/* ---------- Recordes pessoais ---------- */
export function personalRecords(sets: SetRow[]): { exercise: string; weight: number; date: string }[] {
  const map = new Map<string, { weight: number; date: string; name: string }>();
  for (const s of sets) {
    const name = s.exercises?.name ?? "?";
    const cur = map.get(s.exercise_id);
    if (!cur || Number(s.weight) > cur.weight) {
      map.set(s.exercise_id, { weight: Number(s.weight), date: s.completed_at, name });
    }
  }
  return Array.from(map.values())
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((r) => ({ exercise: r.name, weight: r.weight, date: r.date }));
}

/* ---------- Insights automáticos ---------- */
export function generateInsights(args: {
  sessions: SessionRow[];
  sets: SetRow[];
  streak: number;
  weeklyTarget: number;
}): string[] {
  const { sessions, sets, streak, weeklyTarget } = args;
  const out: string[] = [];

  // Best day of week
  const dayCount = new Array(7).fill(0);
  for (const s of sessions) dayCount[new Date(s.started_at).getDay()]++;
  const bestDay = dayCount.indexOf(Math.max(...dayCount));
  const dayNames = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];
  if (dayCount[bestDay] >= 3) out.push(`Você treina mais nas ${dayNames[bestDay]}.`);

  // Average duration
  const durations = sessions.map((s) => (s.duration_seconds ?? 0) / 60).filter((d) => d > 0);
  if (durations.length >= 3) {
    const avgDur = avg(durations);
    if (avgDur > 75) out.push(`Suas sessões duram ${Math.round(avgDur)}min — considere otimizar o descanso.`);
    else if (avgDur < 30) out.push(`Sessões curtas (${Math.round(avgDur)}min) — bom para consistência diária.`);
  }

  // Frequency vs target
  const last28 = sessions.filter((s) => differenceInDays(new Date(), new Date(s.started_at)) <= 28);
  const weeksCovered = 4;
  const avgWeek = last28.length / weeksCovered;
  if (avgWeek >= weeklyTarget) {
    out.push(`Você está ${avgWeek.toFixed(1)}x/semana — acima da sua meta de ${weeklyTarget}x. 🔥`);
  } else if (avgWeek < weeklyTarget * 0.6) {
    out.push(`Frequência abaixo da meta. Tente ${weeklyTarget}x/semana para evolução constante.`);
  }

  // Streak
  if (streak >= 7) out.push(`Sequência de ${streak} dias — você criou um hábito sólido.`);
  else if (streak === 0 && sessions.length > 0) out.push("Quebrou a sequência — bora retomar hoje!");

  // Most worked muscle
  const muscle: Record<string, number> = {};
  for (const s of sets) {
    const m = s.exercises?.muscle_group;
    if (m) muscle[m] = (muscle[m] ?? 0) + 1;
  }
  const topMuscle = Object.entries(muscle).sort((a, b) => b[1] - a[1])[0];
  if (topMuscle) out.push(`${labelMuscle(topMuscle[0])} é seu grupo mais treinado nos últimos 90 dias.`);

  return out.slice(0, 5);
}

/* ---------- Alertas ---------- */
export function alerts(args: {
  sessions: SessionRow[];
  loadEvolutionPct: number;
  weeklyTarget: number;
}): { type: "warning" | "info"; message: string }[] {
  const { sessions, loadEvolutionPct, weeklyTarget } = args;
  const out: { type: "warning" | "info"; message: string }[] = [];

  if (loadEvolutionPct < -5) {
    out.push({ type: "warning", message: `Carga média caiu ${Math.abs(loadEvolutionPct).toFixed(1)}% nos últimos 30 dias.` });
  }
  const last7 = sessions.filter((s) => differenceInDays(new Date(), new Date(s.started_at)) <= 7).length;
  if (last7 < weeklyTarget * 0.5 && sessions.length > 0) {
    out.push({ type: "warning", message: `Apenas ${last7} treino(s) esta semana. Meta: ${weeklyTarget}.` });
  }
  return out;
}

/* ---------- Helpers ---------- */
function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(avg(arr.map((x) => (x - m) ** 2)));
}
function labelMuscle(m: string): string {
  const map: Record<string, string> = {
    chest: "Peito", back: "Costas", shoulders: "Ombros", biceps: "Bíceps",
    triceps: "Tríceps", quads: "Quadríceps", hamstrings: "Posterior",
    glutes: "Glúteo", core: "Core", calves: "Panturrilha",
    forearms: "Antebraço", cardio: "Cardio", full_body: "Full body",
  };
  return map[m] ?? m;
}
