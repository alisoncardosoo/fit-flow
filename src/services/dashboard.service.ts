import { supabase } from "@/integrations/supabase/client";

export type DashboardProfile = {
  display_name: string | null;
  weekly_target: number;
  goal: string | null;
  onboarded: boolean;
};

export type DashboardWorkout = { id: string; name: string; description: string | null };

export type DashboardSession = {
  id: string;
  workout_name: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume: number | null;
};

export type DashboardData = {
  profile: DashboardProfile | null;
  streak: number;
  nextWorkout: DashboardWorkout | null;
  lastSession: DashboardSession | null;
  weekCount: number;
  weekVolume: number;
};

export async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [{ data: prof }, { data: streakData }, { data: workouts }, { data: lastS }, { data: weekData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, weekly_target, goal, onboarded")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.rpc("get_user_streak", { _user_id: userId }),
      supabase
        .from("workouts")
        .select("id, name, description")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase
        .from("workout_sessions")
        .select("id, workout_name, started_at, duration_seconds, total_volume")
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(1),
      supabase
        .from("workout_sessions")
        .select("id, total_volume")
        .gte("started_at", weekAgo.toISOString())
        .not("finished_at", "is", null),
    ]);

  return {
    profile: prof ?? null,
    streak: typeof streakData === "number" ? streakData : 0,
    nextWorkout: workouts?.[0] ?? null,
    lastSession: lastS?.[0] ?? null,
    weekCount: weekData?.length ?? 0,
    weekVolume: weekData?.reduce((sum, s) => sum + Number(s.total_volume ?? 0), 0) ?? 0,
  };
}

export type MotivationInput = {
  streak: number;
  weekCount: number;
  weeklyTarget: number;
  name: string;
};

export async function fetchMotivation(input: MotivationInput): Promise<string> {
  const { data } = await supabase.functions.invoke("motivation", { body: input });
  return data?.message ?? "";
}
