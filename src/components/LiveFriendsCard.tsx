import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getActiveFriendSessions, type ActiveSession } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";

export function LiveFriendsCard() {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    void load();

    const ch = supabase
      .channel("live-friends")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_sessions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    try {
      const rows = await getActiveFriendSessions(user.id);
      setActive(rows);
    } finally {
      setReady(true);
    }
  }

  if (!ready || active.length === 0) return null;

  return (
    <Link to="/social" className="card-premium block rounded-3xl p-5 transition active:scale-[0.98]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Treinando agora</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <ul className="space-y-2">
        {active.slice(0, 3).map((a) => (
          <motion.li
            key={a.user_id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <Avatar name={a.display_name ?? "Atleta"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">{a.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.current_exercise_name ?? a.workout_name} · {a.current_exercise_index + 1}/{a.total_exercises}
              </p>
            </div>
            <Activity className="h-4 w-4 text-emerald-500" />
          </motion.li>
        ))}
      </ul>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "U";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 font-display text-xs font-bold text-emerald-400">
      {initials}
    </div>
  );
}
