import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProfileGoal = Database["public"]["Enums"]["fitness_goal"];
export type ProfileLevel = Database["public"]["Enums"]["fitness_level"];

export type ProfileSettings = {
  display_name: string | null;
  username: string | null;
  goal: ProfileGoal | null;
  level: ProfileLevel | null;
  weekly_target: number;
  default_sets: number;
  default_reps: number;
  default_rest_seconds: number;
};

export type ProfileData = {
  profile: ProfileSettings | null;
  streak: number;
  totalSessions: number;
};

export async function fetchProfileData(userId: string): Promise<ProfileData> {
  const [{ data: prof }, { data: streakData }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, username, goal, level, weekly_target, default_sets, default_reps, default_rest_seconds",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("get_user_streak", { _user_id: userId }),
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .not("finished_at", "is", null),
  ]);
  return {
    profile: prof ?? null,
    streak: typeof streakData === "number" ? streakData : 0,
    totalSessions: count ?? 0,
  };
}

export async function updateProfile(
  userId: string,
  patch: Partial<ProfileSettings>,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
  if (error) throw error;
}
