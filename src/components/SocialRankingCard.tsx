import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, ArrowUpRight, Crown, Medal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getWeeklyRanking, type RankingRow } from "@/lib/social";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Compact weekly ranking card for the Dashboard.
 * Shows top 3 (or fewer) friends + the current user's position.
 */
export function SocialRankingCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RankingRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const r = await getWeeklyRanking(user.id);
        setRows(r);
      } catch {
        setRows([]);
      }
    })();
  }, [user]);

  if (rows === null) {
    return <Skeleton className="h-44 rounded-3xl" />;
  }

  // Show empty state with CTA to add friends
  if (rows.length <= 1) {
    return (
      <Link
        to="/social"
        className="card-premium block rounded-3xl p-5 transition active:scale-[0.98]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Social</p>
            <h3 className="mt-1 font-display text-lg font-extrabold">Treine com amigos</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Convide e veja quem treina mais
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </Link>
    );
  }

  const top = rows.slice(0, 3);

  return (
    <Link to="/social" className="card-premium block rounded-3xl p-5 transition active:scale-[0.98]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ranking da semana
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <ol className="space-y-1.5">
        {top.map((row, i) => {
          const isMe = row.user_id === user?.id;
          const position = i + 1;
          const Icon =
            position === 1 ? <Crown className="h-4 w-4 text-yellow-500" /> :
            position === 2 ? <Medal className="h-4 w-4 text-slate-300" /> :
            <Medal className="h-4 w-4 text-orange-400" />;
          return (
            <li
              key={row.user_id}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                isMe ? "bg-primary/15" : ""
              }`}
            >
              <div className="flex h-6 w-6 items-center justify-center">{Icon}</div>
              <p className="flex-1 truncate text-sm font-bold">
                {row.display_name}{isMe && <span className="ml-1 text-xs text-primary">(você)</span>}
              </p>
              <p className="font-display text-sm font-extrabold tabular-nums">{row.points}</p>
            </li>
          );
        })}
      </ol>
    </Link>
  );
}
