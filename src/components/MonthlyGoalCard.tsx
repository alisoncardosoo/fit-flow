import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MonthlyGoalCard() {
  const { user } = useAuth();
  const [target, setTarget] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [{ data: goal }, { data: prog }] = await Promise.all([
      supabase.from("monthly_goals")
        .select("target_sessions")
        .eq("user_id", user.id).eq("year", year).eq("month", month)
        .maybeSingle(),
      supabase.rpc("get_monthly_progress", { _user_id: user.id, _year: year, _month: month }),
    ]);

    const t = goal?.target_sessions ?? 12;
    if (!goal) {
      // Auto-create default monthly goal
      await supabase.from("monthly_goals").insert({
        user_id: user.id, year, month, target_sessions: 12,
      });
    }
    setTarget(t);
    const sessions = (prog as Array<{ sessions_count: number }> | null)?.[0]?.sessions_count ?? 0;
    setDone(sessions);
    setLoading(false);
  }

  if (loading) return <Skeleton className="h-28 w-full rounded-3xl" />;
  if (target === null) return null;

  const pct = Math.min(100, Math.round((done / target) * 100));
  const hit = done >= target;
  const monthName = MONTH_NAMES[new Date().getMonth()];

  return (
    <Link to="/achievements" className="block card-premium rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${hit ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>
            {hit ? <Check className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Meta de {monthName}
            </p>
            <p className="text-sm font-semibold">
              {done} de {target} treinos {hit && "🏆"}
            </p>
          </div>
        </div>
        <span className="font-display text-xl font-bold">{pct}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </Link>
  );
}
