import { supabase } from "@/integrations/supabase/client";

export type ChallengeType = "most_sessions" | "most_volume" | "most_frequency";
export type ChallengePeriod = "weekly" | "monthly" | "custom";

export type Challenge = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  type: ChallengeType;
  period: ChallengePeriod;
  starts_at: string;
  ends_at: string;
  is_public: boolean;
  created_at: string;
};

export type ChallengeWithMeta = Challenge & {
  participant_count: number;
  is_joined: boolean;
  my_score: number;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  score: number;
  is_me: boolean;
};

export const CHALLENGE_TYPE_LABEL: Record<ChallengeType, string> = {
  most_sessions: "Mais treinos",
  most_volume: "Maior volume (kg)",
  most_frequency: "Maior frequência (dias)",
};

export const CHALLENGE_TYPE_UNIT: Record<ChallengeType, string> = {
  most_sessions: "treinos",
  most_volume: "kg",
  most_frequency: "dias",
};

/** Compute starts_at / ends_at for a period preset. */
export function computePeriodRange(period: ChallengePeriod, customDays = 7): { starts_at: string; ends_at: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "weekly") {
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (period === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + customDays);
  }
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export async function listMyChallenges(userId: string): Promise<ChallengeWithMeta[]> {
  // RLS returns: public challenges, ones I created, or ones I'm in
  const { data: challenges, error } = await supabase
    .from("challenges")
    .select("*")
    .order("ends_at", { ascending: true });
  if (error) throw error;
  if (!challenges?.length) return [];

  const ids = challenges.map((c) => c.id);
  const { data: parts } = await supabase
    .from("challenge_participants")
    .select("challenge_id, user_id, score")
    .in("challenge_id", ids);

  const countMap = new Map<string, number>();
  const myScoreMap = new Map<string, number>();
  const joinedSet = new Set<string>();
  for (const p of parts ?? []) {
    countMap.set(p.challenge_id, (countMap.get(p.challenge_id) ?? 0) + 1);
    if (p.user_id === userId) {
      joinedSet.add(p.challenge_id);
      myScoreMap.set(p.challenge_id, Number(p.score));
    }
  }

  return challenges.map((c) => ({
    ...c,
    participant_count: countMap.get(c.id) ?? 0,
    is_joined: joinedSet.has(c.id),
    my_score: myScoreMap.get(c.id) ?? 0,
  }));
}

export async function createChallenge(input: {
  creator_id: string;
  title: string;
  description?: string;
  type: ChallengeType;
  period: ChallengePeriod;
  custom_days?: number;
  invite_friend_ids?: string[];
}): Promise<string> {
  const { starts_at, ends_at } = computePeriodRange(input.period, input.custom_days ?? 7);
  const { data, error } = await supabase
    .from("challenges")
    .insert({
      creator_id: input.creator_id,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      period: input.period,
      starts_at,
      ends_at,
      is_public: false,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Auto-join creator + invited friends
  const ids = [input.creator_id, ...(input.invite_friend_ids ?? [])];
  await supabase.from("challenge_participants").insert(
    ids.map((uid) => ({ challenge_id: data.id, user_id: uid })),
  );
  return data.id;
}

export async function joinChallenge(challengeId: string, userId: string) {
  const { error } = await supabase
    .from("challenge_participants")
    .insert({ challenge_id: challengeId, user_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function leaveChallenge(challengeId: string, userId: string) {
  await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", userId);
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  return (data as Challenge) ?? null;
}

export async function getChallengeLeaderboard(challengeId: string, myId: string): Promise<LeaderboardRow[]> {
  const { data: parts } = await supabase
    .from("challenge_participants")
    .select("user_id, score")
    .eq("challenge_id", challengeId)
    .order("score", { ascending: false });
  if (!parts?.length) return [];
  const ids = parts.map((p) => p.user_id);
  const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: ids });
  const nameMap = new Map(
    ((profs ?? []) as { user_id: string; display_name: string | null }[]).map((p) => [
      p.user_id,
      p.display_name ?? "Atleta",
    ]),
  );
  return parts.map((p) => ({
    user_id: p.user_id,
    display_name: nameMap.get(p.user_id) ?? "Atleta",
    score: Number(p.score),
    is_me: p.user_id === myId,
  }));
}

export async function deleteChallenge(id: string) {
  await supabase.from("challenge_participants").delete().eq("challenge_id", id);
  await supabase.from("challenges").delete().eq("id", id);
}
