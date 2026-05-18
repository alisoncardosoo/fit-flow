import { supabase } from "@/integrations/supabase/client";

export type Friend = {
  user_id: string;
  display_name: string;
  username: string | null;
  status: "pending_in" | "pending_out" | "accepted";
  friendship_id: string;
  last_session_at: string | null;
  streak: number;
  is_training_now: boolean;
};

export type RankingRow = {
  user_id: string;
  display_name: string;
  username?: string | null;
  sessions: number;
  total_volume: number;
  points: number;
};

export type ComparisonRow = {
  user_id: string;
  display_name: string;
  username?: string | null;
  sessions: number;
  total_volume: number;
  frequency_days: number;
  avg_duration_min: number;
};

/** Get the current user's friend code (auto-created on signup). */
export async function getMyFriendCode(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("friend_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.code ?? null;
}

/** Build the shareable invite link from a code. */
export function buildInviteLink(code: string): string {
  return `${window.location.origin}/social/invite/${code}`;
}

/** Look up a user by their 6-char friend code (returns null if not found). */
export async function findUserByCode(
  code: string,
): Promise<{ user_id: string; display_name: string | null; username: string | null } | null> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) return null;

  const { data: fc } = await supabase
    .from("friend_codes")
    .select("user_id")
    .eq("code", normalized)
    .maybeSingle();

  if (!fc) return null;

  const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: [fc.user_id] });
  const prof = (profs as { user_id: string; display_name: string | null; username: string | null }[] | null)?.[0];

  return {
    user_id: fc.user_id,
    display_name: prof?.display_name ?? null,
    username: prof?.username ?? null,
  };
}

/** Send a friend request. Returns the friendship id or throws. */
export async function sendFriendRequest(myId: string, targetUserId: string): Promise<string> {
  if (myId === targetUserId) throw new Error("Não é possível adicionar a si mesmo.");

  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status, requester_id, addressee_id")
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${myId})`,
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") throw new Error("Vocês já são amigos.");
    if (existing.status === "pending") throw new Error("Convite já enviado.");
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert({ requester_id: myId, addressee_id: targetUserId, status: "pending" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function removeFriend(friendshipId: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

export async function loadFriends(myId: string): Promise<Friend[]> {
  const { data: links } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .neq("status", "declined")
    .neq("status", "blocked");

  if (!links?.length) return [];

  const otherIds = links.map((l) => (l.requester_id === myId ? l.addressee_id : l.requester_id));

  const [{ data: profiles }, { data: lastSessions }] = await Promise.all([
    supabase.rpc("get_public_profiles", { _ids: otherIds }),
    supabase
      .from("workout_sessions")
      .select("user_id, started_at, finished_at")
      .in("user_id", otherIds)
      .order("started_at", { ascending: false }),
  ]);

  const lastByUser: Record<string, { started_at: string; finished_at: string | null }> = {};
  for (const s of lastSessions ?? []) {
    if (!lastByUser[s.user_id]) lastByUser[s.user_id] = { started_at: s.started_at, finished_at: s.finished_at };
  }

  type Prof = { user_id: string; display_name: string | null; username: string | null };
  const profileByUser = new Map<string, Prof>(
    ((profiles as Prof[] | null) ?? []).map((p) => [p.user_id, p] as const),
  );
  const now = Date.now();

  const streaks = await Promise.all(
    otherIds.map(async (uid) => {
      const { data } = await supabase.rpc("get_user_streak", { _user_id: uid });
      return [uid, typeof data === "number" ? data : 0] as const;
    }),
  );
  const streakByUser = new Map(streaks);

  return links.map((l) => {
    const otherId = l.requester_id === myId ? l.addressee_id : l.requester_id;
    const last = lastByUser[otherId];
    const isTrainingNow = !!last && !last.finished_at && now - new Date(last.started_at).getTime() < 3 * 60 * 60 * 1000;
    let status: Friend["status"];
    if (l.status === "accepted") status = "accepted";
    else if (l.requester_id === myId) status = "pending_out";
    else status = "pending_in";

    const prof = profileByUser.get(otherId);
    return {
      user_id: otherId,
      display_name: prof?.display_name ?? "Atleta",
      username: prof?.username ?? null,
      status,
      friendship_id: l.id,
      last_session_at: last?.started_at ?? null,
      streak: streakByUser.get(otherId) ?? 0,
      is_training_now: isTrainingNow,
    };
  });
}

export async function getWeeklyRanking(myId: string): Promise<RankingRow[]> {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const { data, error } = await supabase.rpc("get_friend_ranking", {
    _user_id: myId,
    _start: start.toISOString(),
    _end: end.toISOString(),
  });
  if (error) throw error;
  const rows = (data ?? []) as RankingRow[];
  return hydrateUsernames(rows);
}

/** Compare two users (last N days). */
export async function getFriendComparison(meId: string, friendId: string, days = 30): Promise<ComparisonRow[]> {
  const { data, error } = await supabase.rpc("get_friend_comparison", {
    _me: meId,
    _friend: friendId,
    _days: days,
  });
  if (error) throw error;
  const rows = (data ?? []) as ComparisonRow[];
  return hydrateUsernames(rows);
}

/** Bulk-load usernames and merge into the rows. */
async function hydrateUsernames<T extends { user_id: string; username?: string | null }>(
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.user_id);
  const { data } = await supabase.rpc("get_public_profiles", { _ids: ids });
  const map = new Map<string, string | null>(
    ((data as { user_id: string; username: string | null }[] | null) ?? []).map((p) => [
      p.user_id,
      p.username,
    ]),
  );
  return rows.map((r) => ({ ...r, username: map.get(r.user_id) ?? null }));
}

/* ---------------- Reactions ---------------- */
export type ReactionEmoji = "flex" | "fire" | "clap";

export const REACTION_EMOJI: Record<ReactionEmoji, string> = {
  flex: "💪",
  fire: "🔥",
  clap: "👏",
};

export async function toggleReaction(sessionId: string, fromUserId: string, emoji: ReactionEmoji) {
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("session_id", sessionId)
    .eq("from_user_id", fromUserId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("reactions").insert({ session_id: sessionId, from_user_id: fromUserId, emoji });
  return true;
}

export async function getReactionsBatch(sessionIds: string[]): Promise<Record<string, { emoji: ReactionEmoji; from_user_id: string }[]>> {
  if (sessionIds.length === 0) return {};
  const { data } = await supabase
    .from("reactions")
    .select("session_id, emoji, from_user_id")
    .in("session_id", sessionIds);
  const map: Record<string, { emoji: ReactionEmoji; from_user_id: string }[]> = {};
  for (const r of data ?? []) {
    (map[r.session_id] ??= []).push({ emoji: r.emoji as ReactionEmoji, from_user_id: r.from_user_id });
  }
  return map;
}

/* ---------------- Active session presence ---------------- */
export type ActiveSession = {
  user_id: string;
  session_id: string;
  workout_name: string;
  current_exercise_index: number;
  total_exercises: number;
  current_exercise_name: string | null;
  started_at: string;
  display_name?: string;
};

export async function startActiveSession(payload: {
  user_id: string;
  session_id: string;
  workout_name: string;
  total_exercises: number;
  current_exercise_name: string;
}) {
  await supabase.from("active_sessions").upsert({
    user_id: payload.user_id,
    session_id: payload.session_id,
    workout_name: payload.workout_name,
    total_exercises: payload.total_exercises,
    current_exercise_index: 0,
    current_exercise_name: payload.current_exercise_name,
    updated_at: new Date().toISOString(),
  });
}

export async function updateActiveSession(userId: string, idx: number, exerciseName: string) {
  await supabase
    .from("active_sessions")
    .update({
      current_exercise_index: idx,
      current_exercise_name: exerciseName,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function endActiveSession(userId: string) {
  await supabase.from("active_sessions").delete().eq("user_id", userId);
}

export async function getActiveFriendSessions(myId: string): Promise<ActiveSession[]> {
  // RLS ensures only friends' rows return
  const { data: rows } = await supabase
    .from("active_sessions")
    .select("*")
    .neq("user_id", myId);
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.user_id);
  const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: ids });
  const nameMap = new Map(
    ((profs ?? []) as { user_id: string; display_name: string | null }[]).map((p) => [
      p.user_id,
      p.display_name ?? "Atleta",
    ]),
  );
  return rows.map((r) => ({ ...r, display_name: nameMap.get(r.user_id) ?? "Atleta" }));
}
