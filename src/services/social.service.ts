import {
  loadFriends,
  getWeeklyRanking,
  getMyFriendCode,
  type Friend,
  type RankingRow,
} from "@/lib/social";

export type SocialData = {
  code: string;
  friends: Friend[];
  ranking: RankingRow[];
};

export async function fetchSocialData(userId: string): Promise<SocialData> {
  const [c, f, r] = await Promise.all([
    getMyFriendCode(userId),
    loadFriends(userId),
    getWeeklyRanking(userId),
  ]);
  return { code: c ?? "", friends: f, ranking: r };
}
