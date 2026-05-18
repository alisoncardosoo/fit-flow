import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Goal } from "@/hooks/useGoalProgress";
import type { SparklinePoint } from "@/components/GoalSparkline";

const DAYS = 60;
const PAGE_SIZE = 1000; // Supabase row cap per request
const SOURCE_STALE = 5 * 60_000; // 5 min — sources change slowly
const SOURCE_GC = 30 * 60_000; // keep in cache 30 min after unmount
const DERIVED_STALE = 60_000;

// ---------- date utils ----------
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfWindow() {
  const d = new Date();
  d.setDate(d.getDate() - DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function startOfMonth(d: Date) {
  const date = new Date(d);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ---------- paginated fetch helper ----------
type Range = { from: number; to: number };
async function fetchAllPages<T>(
  build: (range: Range) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Cap to 10 pages (10k rows) — sparklines never need more for a 60d window.
  for (let i = 0; i < 10; i++) {
    const to = from + PAGE_SIZE - 1;
    const { data } = await build({ from, to });
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

// ============= SOURCES (cached, deduplicated) =============

type Measurement = { measured_at: string; weight: number };
async function fetchMeasurementsSource(userId: string): Promise<Measurement[]> {
  const since = isoDate(startOfWindow());
  const rows = await fetchAllPages<Measurement>(({ from, to }) =>
    supabase
      .from("body_measurements")
      .select("measured_at, weight")
      .eq("user_id", userId)
      .gte("measured_at", since)
      .order("measured_at", { ascending: true })
      .range(from, to),
  );
  return rows.map((r) => ({ measured_at: r.measured_at, weight: Number(r.weight) }));
}

type SessionRow = { started_at: string };
async function fetchSessionsSource(userId: string): Promise<SessionRow[]> {
  const since = startOfWindow().toISOString();
  return fetchAllPages<SessionRow>(({ from, to }) =>
    supabase
      .from("workout_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .gte("started_at", since)
      .order("started_at", { ascending: true })
      .range(from, to),
  );
}

type SetRow = { completed_at: string; weight: number; reps: number };
async function fetchSetLogsSource(userId: string, exerciseId: string): Promise<SetRow[]> {
  const since = startOfWindow().toISOString();
  const rows = await fetchAllPages<SetRow>(({ from, to }) =>
    supabase
      .from("set_logs")
      .select("completed_at, weight, reps")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .gte("completed_at", since)
      .gte("reps", 1)
      .order("completed_at", { ascending: true })
      .range(from, to),
  );
  return rows.map((r) => ({
    completed_at: r.completed_at,
    weight: Number(r.weight),
    reps: Number(r.reps),
  }));
}

// Source query keys — shared across all goals of the same kind.
const sourceKeys = {
  measurements: (uid: string) => ["goal-source", "measurements", uid] as const,
  sessions: (uid: string) => ["goal-source", "sessions", uid] as const,
  setLogs: (uid: string, exerciseId: string) =>
    ["goal-source", "set-logs", uid, exerciseId] as const,
};

async function loadSource<T>(
  qc: QueryClient,
  key: readonly unknown[],
  fetcher: () => Promise<T>,
): Promise<T> {
  return qc.fetchQuery({
    queryKey: key,
    queryFn: fetcher,
    staleTime: SOURCE_STALE,
    gcTime: SOURCE_GC,
  });
}

// ============= DERIVE per-goal series from cached source =============

function deriveBodyweight(rows: Measurement[]): SparklinePoint[] {
  return rows.map((r) => ({ date: r.measured_at, value: r.weight }));
}

function deriveExerciseLoad(rows: SetRow[], goal: Goal): SparklinePoint[] {
  const dailyMax = new Map<string, number>();
  for (const r of rows) {
    const key = r.completed_at.slice(0, 10);
    dailyMax.set(key, Math.max(dailyMax.get(key) ?? 0, r.weight));
  }
  let running = Number(goal.start_value ?? 0);
  return Array.from(dailyMax.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, w]) => {
      running = Math.max(running, w);
      return { date, value: running };
    });
}

function deriveFrequency(rows: SessionRow[], goal: Goal): SparklinePoint[] {
  const sessions = rows.map((r) => new Date(r.started_at));
  const points: SparklinePoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekly = goal.type === "weekly_frequency";

  for (let i = DAYS; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const periodStart = weekly ? startOfWeek(day) : startOfMonth(day);
    let count = 0;
    for (const s of sessions) if (s >= periodStart && s <= day) count++;
    points.push({ date: isoDate(day), value: count });
  }
  return points;
}

// ============= public hook =============

async function fetchHistory(
  qc: QueryClient,
  goal: Goal,
  userId: string,
): Promise<SparklinePoint[]> {
  if (goal.type === "bodyweight") {
    const rows = await loadSource(qc, sourceKeys.measurements(userId), () =>
      fetchMeasurementsSource(userId),
    );
    return deriveBodyweight(rows);
  }

  if (goal.type === "exercise_load" && goal.exercise_id) {
    const rows = await loadSource(qc, sourceKeys.setLogs(userId, goal.exercise_id), () =>
      fetchSetLogsSource(userId, goal.exercise_id!),
    );
    return deriveExerciseLoad(rows, goal);
  }

  if (goal.type === "weekly_frequency" || goal.type === "monthly_frequency") {
    const rows = await loadSource(qc, sourceKeys.sessions(userId), () =>
      fetchSessionsSource(userId),
    );
    return deriveFrequency(rows, goal);
  }

  return [];
}

export function useGoalHistory(goal: Goal | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Stable cache key: tied to the *source* — derivations are pure, so we can
  // safely re-derive without refetching when only the goal metadata changes.
  const queryKey = useMemo(
    () => ["goal-history", user?.id, goal?.id, goal?.type, goal?.exercise_id, goal?.start_value],
    [user?.id, goal?.id, goal?.type, goal?.exercise_id, goal?.start_value],
  );

  return useQuery({
    queryKey,
    queryFn: () => fetchHistory(qc, goal!, user!.id),
    enabled: !!user && !!goal && goal.type !== "custom",
    staleTime: DERIVED_STALE,
    gcTime: SOURCE_GC,
  });
}

/** Manually invalidate every cached goal-history source for a user. */
export function invalidateGoalHistorySources(qc: QueryClient, userId: string) {
  qc.invalidateQueries({ queryKey: ["goal-source"] });
  qc.invalidateQueries({ queryKey: ["goal-history", userId] });
}
