import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type GoalType =
  | "bodyweight"
  | "exercise_load"
  | "weekly_frequency"
  | "monthly_frequency"
  | "custom";

export type Goal = {
  id: string;
  user_id: string;
  type: GoalType;
  title: string;
  exercise_id: string | null;
  start_value: number;
  target_value: number;
  unit: string;
  deadline: string | null;
  achieved_at: string | null;
  notes: string | null;
  current_override: number | null;
  created_at: string;
  updated_at: string;
};

export type GoalWithProgress = Goal & {
  current_value: number;
  progress: number; // 0..1
  exercise_name?: string | null;
};

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(d = new Date()) {
  const date = new Date(d);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function computeCurrentValue(goal: Goal, userId: string): Promise<number> {
  if (goal.type === "exercise_load" && goal.exercise_id) {
    const { data } = await supabase.rpc("get_exercise_pr", {
      _user_id: userId,
      _exercise_id: goal.exercise_id,
    });
    return Number(data ?? 0);
  }
  if (goal.type === "weekly_frequency") {
    const since = startOfWeek().toISOString();
    const { count } = await supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .gte("started_at", since);
    return count ?? 0;
  }
  if (goal.type === "monthly_frequency") {
    const since = startOfMonth().toISOString();
    const { count } = await supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .gte("started_at", since);
    return count ?? 0;
  }
  if (goal.type === "bodyweight") {
    const { data } = await supabase
      .from("body_measurements")
      .select("weight")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.weight != null) return Number(data.weight);
    return Number(goal.start_value ?? 0);
  }
  if (goal.type === "custom") {
    if (goal.current_override != null) return Number(goal.current_override);
    return Number(goal.start_value ?? 0);
  }
  return Number(goal.start_value ?? 0);
}

export function progressOf(goal: Goal, current: number): number {
  const start = Number(goal.start_value ?? 0);
  const target = Number(goal.target_value ?? 0);
  if (target === start) return current >= target ? 1 : 0;
  if (target < start) {
    const total = start - target;
    const done = start - current;
    return Math.max(0, Math.min(1, done / total));
  }
  const total = target - start;
  const done = current - start;
  return Math.max(0, Math.min(1, done / total));
}

type GoalRow = Goal & { exercises?: { name: string | null } | null };

async function fetchGoals(userId: string): Promise<GoalWithProgress[]> {
  const { data: rows } = await supabase
    .from("goals")
    .select("*, exercises(name)")
    .eq("user_id", userId)
    .order("achieved_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  return Promise.all(
    ((rows as GoalRow[]) ?? []).map(async (g) => {
      const current = await computeCurrentValue(g, userId);
      return {
        ...g,
        current_value: current,
        progress: progressOf(g, current),
        exercise_name: g.exercises?.name ?? null,
      };
    }),
  );
}

export function useGoals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: () => fetchGoals(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
  return {
    goals: query.data ?? [],
    loading: query.isLoading,
    reload: query.refetch,
    invalidate: () => qc.invalidateQueries({ queryKey: ["goals", user?.id] }),
  };
}
