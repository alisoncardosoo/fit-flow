// Catalog of all badges + achievement-checking logic.
import { supabase } from "@/integrations/supabase/client";

export type BadgeTier = "bronze" | "silver" | "gold";
export type BadgeShape = "disc" | "banner" | "hex" | "bolt";

export type BadgeDef = {
  code: string;
  title: string;
  description: string;
  icon: string; // lucide icon name (handled in UI)
  tier: BadgeTier;
  shape: BadgeShape;
  category: "milestone" | "consistency" | "strength" | "monthly";
};

export const BADGE_CATALOG: BadgeDef[] = [
  // Milestones — disc style (concentric rings, like Move/Exercise)
  { code: "first_workout", title: "Primeiro treino", description: "Você completou seu primeiro treino. Bem-vindo!", icon: "Sparkles", tier: "bronze", shape: "disc", category: "milestone" },
  { code: "sessions_10", title: "10 treinos", description: "10 treinos concluídos. Está virando hábito.", icon: "Award", tier: "bronze", shape: "disc", category: "milestone" },
  { code: "sessions_50", title: "50 treinos", description: "50 treinos no histórico. Disciplina pura.", icon: "Medal", tier: "silver", shape: "disc", category: "milestone" },
  { code: "sessions_100", title: "100 treinos", description: "Membro do clube dos 100. Lendário.", icon: "Trophy", tier: "gold", shape: "disc", category: "milestone" },
  { code: "sessions_250", title: "250 treinos", description: "250 treinos. Outro nível.", icon: "Crown", tier: "gold", shape: "disc", category: "milestone" },

  // Consistency — bolt hexagon (energy / streak)
  { code: "streak_3", title: "Sequência de 3", description: "3 dias seguidos treinando.", icon: "Flame", tier: "bronze", shape: "bolt", category: "consistency" },
  { code: "streak_7", title: "Semana perfeita", description: "7 dias seguidos. Que ritmo!", icon: "Flame", tier: "silver", shape: "bolt", category: "consistency" },
  { code: "streak_30", title: "Sequência de 30", description: "Um mês inteiro sem falhar.", icon: "Flame", tier: "gold", shape: "bolt", category: "consistency" },

  // Monthly — banner/shield (twin overlap rings)
  { code: "first_month_complete", title: "Primeiro mês completo", description: "Você bateu sua meta mensal pela primeira vez.", icon: "CalendarCheck", tier: "silver", shape: "banner", category: "monthly" },
  { code: "month_goal_3x", title: "3 metas mensais", description: "Bateu a meta mensal 3 vezes.", icon: "CalendarCheck", tier: "gold", shape: "banner", category: "monthly" },

  // Strength PRs — hex (faceted, like the Perfect Week badges)
  { code: "pr_bench_100", title: "Supino 100kg", description: "Recorde de 100kg ou mais no supino.", icon: "Dumbbell", tier: "gold", shape: "hex", category: "strength" },
  { code: "pr_squat_140", title: "Agachamento 140kg", description: "Recorde de 140kg ou mais no agachamento.", icon: "Dumbbell", tier: "gold", shape: "hex", category: "strength" },
  { code: "pr_deadlift_180", title: "Terra 180kg", description: "Recorde de 180kg ou mais no levantamento terra.", icon: "Dumbbell", tier: "gold", shape: "hex", category: "strength" },
  { code: "pr_overhead_60", title: "Desenvolvimento 60kg", description: "Recorde de 60kg ou mais no desenvolvimento.", icon: "Dumbbell", tier: "silver", shape: "hex", category: "strength" },

  // Volume — disc (rings = progress)
  { code: "volume_10t", title: "10 toneladas", description: "10.000 kg de volume acumulado.", icon: "TrendingUp", tier: "silver", shape: "disc", category: "milestone" },
  { code: "volume_50t", title: "50 toneladas", description: "50.000 kg movidos. Brutal.", icon: "TrendingUp", tier: "gold", shape: "disc", category: "milestone" },
];

export const BADGE_BY_CODE: Record<string, BadgeDef> = Object.fromEntries(
  BADGE_CATALOG.map((b) => [b.code, b])
);

const STRENGTH_PRS: Array<{ code: string; namePatterns: string[]; min: number }> = [
  { code: "pr_bench_100", namePatterns: ["supino reto", "bench press"], min: 100 },
  { code: "pr_squat_140", namePatterns: ["agachamento livre", "back squat", "agachamento"], min: 140 },
  { code: "pr_deadlift_180", namePatterns: ["levantamento terra", "deadlift", "terra"], min: 180 },
  { code: "pr_overhead_60", namePatterns: ["desenvolvimento militar", "overhead press", "desenvolvimento"], min: 60 },
];

export type AwardedBadge = BadgeDef;

/**
 * Evaluates which new badges the user just earned and inserts them.
 * Returns the list of newly awarded badges (for toasts).
 */
export async function checkAndAwardBadges(userId: string): Promise<AwardedBadge[]> {
  // Already-earned codes
  const { data: existing } = await supabase
    .from("achievements")
    .select("code")
    .eq("user_id", userId);
  const earned = new Set((existing ?? []).map((a) => a.code));

  const candidates: BadgeDef[] = [];

  // Total sessions + total volume
  const { data: totalsData } = await supabase
    .from("workout_sessions")
    .select("total_volume")
    .eq("user_id", userId)
    .not("finished_at", "is", null);
  const totalSessions = totalsData?.length ?? 0;
  const totalVolume = (totalsData ?? []).reduce((a, s) => a + Number(s.total_volume ?? 0), 0);

  if (totalSessions >= 1) candidates.push(BADGE_BY_CODE.first_workout);
  if (totalSessions >= 10) candidates.push(BADGE_BY_CODE.sessions_10);
  if (totalSessions >= 50) candidates.push(BADGE_BY_CODE.sessions_50);
  if (totalSessions >= 100) candidates.push(BADGE_BY_CODE.sessions_100);
  if (totalSessions >= 250) candidates.push(BADGE_BY_CODE.sessions_250);
  if (totalVolume >= 10000) candidates.push(BADGE_BY_CODE.volume_10t);
  if (totalVolume >= 50000) candidates.push(BADGE_BY_CODE.volume_50t);

  // Streak
  const { data: streakData } = await supabase.rpc("get_user_streak", { _user_id: userId });
  const streak = typeof streakData === "number" ? streakData : 0;
  if (streak >= 3) candidates.push(BADGE_BY_CODE.streak_3);
  if (streak >= 7) candidates.push(BADGE_BY_CODE.streak_7);
  if (streak >= 30) candidates.push(BADGE_BY_CODE.streak_30);

  // Monthly goal achievements
  const { data: goals } = await supabase
    .from("monthly_goals")
    .select("year, month, target_sessions")
    .eq("user_id", userId);
  let monthsHit = 0;
  for (const g of goals ?? []) {
    const { data: prog } = await supabase.rpc("get_monthly_progress", {
      _user_id: userId,
      _year: g.year,
      _month: g.month,
    });
    const sessions = (prog as Array<{ sessions_count: number }> | null)?.[0]?.sessions_count ?? 0;
    if (sessions >= g.target_sessions) monthsHit++;
  }
  if (monthsHit >= 1) candidates.push(BADGE_BY_CODE.first_month_complete);
  if (monthsHit >= 3) candidates.push(BADGE_BY_CODE.month_goal_3x);

  // Strength PRs — match exercises by name
  const { data: matchedExercises } = await supabase
    .from("exercises")
    .select("id, name");
  for (const pr of STRENGTH_PRS) {
    const exercise = (matchedExercises ?? []).find((e) =>
      pr.namePatterns.some((p) => e.name.toLowerCase().includes(p))
    );
    if (!exercise) continue;
    const { data: best } = await supabase.rpc("get_exercise_pr", {
      _user_id: userId,
      _exercise_id: exercise.id,
    });
    const max = typeof best === "number" ? best : Number(best ?? 0);
    if (max >= pr.min) candidates.push(BADGE_BY_CODE[pr.code]);
  }

  // Filter out already-earned
  const fresh = candidates.filter((b) => b && !earned.has(b.code));
  if (fresh.length === 0) return [];

  const inserts = fresh.map((b) => ({
    user_id: userId,
    code: b.code,
    title: b.title,
    description: b.description,
    icon: b.icon,
    tier: b.tier,
  }));

  // upsert with the new UNIQUE(user_id, code) constraint to prevent duplicates
  // under concurrent inserts (server triggers + client check race).
  const { error } = await supabase
    .from("achievements")
    .upsert(inserts, { onConflict: "user_id,code", ignoreDuplicates: true });
  if (error) {
    console.error("Failed to insert achievements", error);
    return [];
  }
  return fresh;
}
