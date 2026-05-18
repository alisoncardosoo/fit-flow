import { differenceInCalendarDays } from "date-fns";
import type { GoalWithProgress } from "@/hooks/useGoalProgress";

export type TrendStatus = "improving" | "stagnant" | "regressing" | "achieved";

export type TrendInfo = {
  status: TrendStatus;
  /** Percentage points ahead (+) or behind (-) the expected linear pace. */
  delta: number;
  label: string;
};

/**
 * Lightweight trend inference based on actual progress vs. expected linear pace
 * between created_at and deadline. Used until a full historical engine ships.
 */
export function inferGoalTrend(goal: GoalWithProgress): TrendInfo | null {
  if (goal.achieved_at || goal.progress >= 1) {
    return { status: "achieved", delta: 0, label: "Conquistada" };
  }

  const start = new Date(goal.created_at);
  const now = new Date();
  const elapsed = Math.max(0, differenceInCalendarDays(now, start));

  // Need at least a couple of days of history to judge a trend.
  if (elapsed < 2) return null;

  const actualPct = goal.progress * 100;

  // If there's a deadline, compare to the linear ideal. Otherwise, use a soft
  // 90-day reference window so trends still surface for open-ended goals.
  const totalDays = goal.deadline
    ? Math.max(1, differenceInCalendarDays(new Date(goal.deadline), start))
    : 90;

  const expectedPct = Math.min(100, (elapsed / totalDays) * 100);
  const delta = actualPct - expectedPct;

  if (delta >= 5) return { status: "improving", delta, label: "Melhorando" };
  if (delta <= -10) return { status: "regressing", delta, label: "Regredindo" };
  return { status: "stagnant", delta, label: "Estagnado" };
}
