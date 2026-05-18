import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, X, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BADGE_CATALOG, type BadgeDef, type BadgeTier } from "@/lib/badges";
import { BadgeIcon } from "@/components/BadgeIcon";
import { celebrate } from "@/lib/celebrate";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Earned = { code: string; earned_at: string };

// Per-badge target/current → progress bars on locked badges.
type BadgeProgress = { current: number; target: number; unit: string };

export default function Achievements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [earned, setEarned] = useState<Record<string, string>>({}); // code -> earned_at
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, BadgeProgress>>({});
  const [selected, setSelected] = useState<BadgeDef | null>(null);
  const [revealing, setRevealing] = useState<Set<string>>(new Set());
  const confettiFired = useRef(false);

  // Monthly goal
  const [goalTarget, setGoalTarget] = useState(12);
  const [goalDone, setGoalDone] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftTarget, setDraftTarget] = useState("12");

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [{ data: ach }, { data: goal }, { data: prog }, { data: totals }, { data: streakData }, { data: monthGoals }] = await Promise.all([
      supabase.from("achievements").select("code, earned_at").eq("user_id", user.id),
      supabase.from("monthly_goals").select("target_sessions").eq("user_id", user.id).eq("year", year).eq("month", month).maybeSingle(),
      supabase.rpc("get_monthly_progress", { _user_id: user.id, _year: year, _month: month }),
      supabase.from("workout_sessions").select("total_volume").eq("user_id", user.id).not("finished_at", "is", null),
      supabase.rpc("get_user_streak", { _user_id: user.id }),
      supabase.from("monthly_goals").select("year, month, target_sessions").eq("user_id", user.id),
    ]);

    const map: Record<string, string> = {};
    (ach as Earned[] | null)?.forEach((a) => { map[a.code] = a.earned_at; });
    setEarned(map);

    // Detect newly earned badges (not yet seen on this device)
    if (user) {
      const seenKey = `ach_seen_${user.id}`;
      let seen: string[] = [];
      try { seen = JSON.parse(localStorage.getItem(seenKey) ?? "[]"); } catch { seen = []; }
      const earnedCodes = Object.keys(map);
      const fresh = earnedCodes.filter((c) => !seen.includes(c));
      if (fresh.length > 0) {
        setRevealing(new Set(fresh));
        if (!confettiFired.current) {
          confettiFired.current = true;
          setTimeout(() => celebrate(), 400);
        }
        // Persist as seen so it doesn't replay on next visit
        localStorage.setItem(seenKey, JSON.stringify(earnedCodes));
        // Clear reveal flag after the animation completes
        setTimeout(() => setRevealing(new Set()), 2200);
      } else {
        // Keep storage in sync (in case codes were removed)
        localStorage.setItem(seenKey, JSON.stringify(earnedCodes));
      }
    }

    const t = goal?.target_sessions ?? 12;
    setGoalTarget(t);
    setDraftTarget(String(t));
    setGoalDone((prog as Array<{ sessions_count: number }> | null)?.[0]?.sessions_count ?? 0);

    // ---- Compute progress for each badge ----
    const totalSessions = totals?.length ?? 0;
    const totalVolume = (totals ?? []).reduce((a, s) => a + Number(s.total_volume ?? 0), 0);
    const streak = typeof streakData === "number" ? streakData : 0;

    // Months hit (sessions vs target per month)
    let monthsHit = 0;
    for (const g of (monthGoals as Array<{ year: number; month: number; target_sessions: number }> | null) ?? []) {
      const { data: p } = await supabase.rpc("get_monthly_progress", {
        _user_id: user.id, _year: g.year, _month: g.month,
      });
      const s = (p as Array<{ sessions_count: number }> | null)?.[0]?.sessions_count ?? 0;
      if (s >= g.target_sessions) monthsHit++;
    }

    // Strength PRs — best load per known exercise
    const PR_PATTERNS: Record<string, { patterns: string[]; target: number }> = {
      pr_bench_100: { patterns: ["supino reto", "bench press"], target: 100 },
      pr_squat_140: { patterns: ["agachamento livre", "back squat", "agachamento"], target: 140 },
      pr_deadlift_180: { patterns: ["levantamento terra", "deadlift", "terra"], target: 180 },
      pr_overhead_60: { patterns: ["desenvolvimento militar", "overhead press", "desenvolvimento"], target: 60 },
    };
    const prMax: Record<string, number> = {};
    const { data: exercises } = await supabase.from("exercises").select("id, name");
    for (const [code, def] of Object.entries(PR_PATTERNS)) {
      const ex = (exercises ?? []).find((e) => def.patterns.some((p) => e.name.toLowerCase().includes(p)));
      if (!ex) { prMax[code] = 0; continue; }
      const { data: best } = await supabase.rpc("get_exercise_pr", { _user_id: user.id, _exercise_id: ex.id });
      prMax[code] = typeof best === "number" ? best : Number(best ?? 0);
    }

    const prog2: Record<string, BadgeProgress> = {
      first_workout: { current: totalSessions, target: 1, unit: "treinos" },
      sessions_10: { current: totalSessions, target: 10, unit: "treinos" },
      sessions_50: { current: totalSessions, target: 50, unit: "treinos" },
      sessions_100: { current: totalSessions, target: 100, unit: "treinos" },
      sessions_250: { current: totalSessions, target: 250, unit: "treinos" },
      streak_3: { current: streak, target: 3, unit: "dias" },
      streak_7: { current: streak, target: 7, unit: "dias" },
      streak_30: { current: streak, target: 30, unit: "dias" },
      first_month_complete: { current: monthsHit, target: 1, unit: "mês" },
      month_goal_3x: { current: monthsHit, target: 3, unit: "meses" },
      volume_10t: { current: Math.round(totalVolume / 1000), target: 10, unit: "t" },
      volume_50t: { current: Math.round(totalVolume / 1000), target: 50, unit: "t" },
      pr_bench_100: { current: prMax.pr_bench_100 ?? 0, target: 100, unit: "kg" },
      pr_squat_140: { current: prMax.pr_squat_140 ?? 0, target: 140, unit: "kg" },
      pr_deadlift_180: { current: prMax.pr_deadlift_180 ?? 0, target: 180, unit: "kg" },
      pr_overhead_60: { current: prMax.pr_overhead_60 ?? 0, target: 60, unit: "kg" },
    };
    setProgress(prog2);

    setLoading(false);
  }

  async function saveGoal() {
    if (!user) return;
    const n = Math.max(1, Math.min(60, parseInt(draftTarget, 10) || 12));
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { error } = await supabase
      .from("monthly_goals")
      .upsert(
        { user_id: user.id, year, month, target_sessions: n },
        { onConflict: "user_id,year,month" }
      );
    if (error) { toast.error("Erro ao salvar meta"); return; }
    setGoalTarget(n);
    setEditingGoal(false);
    toast.success("Meta atualizada!");
  }

  const earnedCount = Object.keys(earned).length;
  const totalCount = BADGE_CATALOG.length;
  const monthName = MONTH_NAMES[new Date().getMonth()];
  const pct = Math.min(100, Math.round((goalDone / goalTarget) * 100));

  const grouped: Record<string, BadgeDef[]> = {
    monthly: BADGE_CATALOG.filter((b) => b.category === "monthly"),
    consistency: BADGE_CATALOG.filter((b) => b.category === "consistency"),
    milestone: BADGE_CATALOG.filter((b) => b.category === "milestone"),
    strength: BADGE_CATALOG.filter((b) => b.category === "strength"),
  };

  const CATEGORY_TITLES: Record<string, string> = {
    monthly: "Metas mensais",
    consistency: "Consistência",
    milestone: "Marcos",
    strength: "Força (PRs)",
  };

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow={`${earnedCount} de ${totalCount} medalhas`}
        title="Conquistas"
        subtitle="Suas vitórias acumuladas"
        backTo={-1}
      />

      {/* Monthly goal */}
      <div className="mb-6 card-premium rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meta de {monthName}</p>
            {!editingGoal ? (
              <p className="mt-1 font-display text-2xl font-bold">
                {goalDone} <span className="text-muted-foreground">/ {goalTarget}</span>
                <span className="ml-2 text-sm text-muted-foreground">treinos</span>
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={draftTarget}
                  onChange={(e) => setDraftTarget(e.target.value)}
                  className="h-10 w-20 rounded-xl bg-secondary text-center"
                />
                <Button size="sm" onClick={saveGoal} className="h-10 rounded-xl bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingGoal(false); setDraftTarget(String(goalTarget)); }} className="h-10 rounded-xl">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {!editingGoal && (
            <button onClick={() => setEditingGoal(true)} className="rounded-xl bg-secondary p-2 text-muted-foreground hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <p className="mt-2 text-right text-xs text-muted-foreground">{pct}% concluído</p>
      </div>

      {/* Badges grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-7 pb-8">
          {Object.entries(grouped).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {CATEGORY_TITLES[cat]}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {list.map((b, idx) => {
                  const got = b.code in earned;
                  const isRevealing = revealing.has(b.code);
                  return (
                    <motion.button
                      key={b.code}
                      type="button"
                      onClick={() => setSelected(b)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center transition active:scale-95"
                    >
                      <div style={{ perspective: 600 }} className="relative">
                        <AnimatePresence mode="wait" initial={false}>
                          {isRevealing ? (
                            <motion.div
                              key="reveal"
                              initial={{ rotateY: 0, scale: 1 }}
                              animate={{ rotateY: 360, scale: [1, 1.18, 1] }}
                              transition={{ duration: 1.1, ease: "easeInOut" }}
                              style={{ transformStyle: "preserve-3d" }}
                            >
                              <BadgeIcon name={b.icon} tier={b.tier} shape={b.shape} earned size={84} />
                            </motion.div>
                          ) : (
                            <motion.div
                              key={got ? "color" : "bw"}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              <BadgeIcon name={b.icon} tier={b.tier} shape={b.shape} earned={got} size={84} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <p className={`line-clamp-2 text-[10px] font-bold leading-tight ${got ? "text-foreground" : "text-muted-foreground"}`}>
                        {b.title}
                      </p>
                      {got && (
                        <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                          {format(new Date(earned[b.code]), "d MMM", { locale: ptBR })}
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Badge detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm rounded-3xl border-border/40 bg-card p-0">
          {selected && (() => {
            const got = selected.code in earned;
            const p = progress[selected.code];
            const pct = p ? Math.min(100, Math.round((p.current / p.target) * 100)) : 0;
            const remaining = p ? Math.max(0, p.target - p.current) : 0;
            return (
              <div className="flex flex-col items-center px-6 py-7 text-center">
                <DialogHeader className="sr-only">
                  <DialogTitle>{selected.title}</DialogTitle>
                </DialogHeader>
                <BadgeIcon
                  name={selected.icon}
                  tier={selected.tier}
                  shape={selected.shape}
                  earned={got}
                  size={140}
                />
                <h3 className="mt-5 font-display text-xl font-extrabold tracking-tight">
                  {selected.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {selected.description}
                </p>

                {got ? (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Conquistado em {format(new Date(earned[selected.code]), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                ) : p ? (
                  <div className="mt-5 w-full">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground">
                        <Lock className="h-3 w-3" /> Progresso
                      </span>
                      <span className="font-display font-extrabold tabular-nums">
                        {formatVal(p.current)} / {formatVal(p.target)} {p.unit}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {remaining > 0
                        ? `Faltam ${formatVal(remaining)} ${p.unit} para desbloquear`
                        : "Pronto para desbloquear no próximo treino!"}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Lock className="h-3 w-3" /> Bloqueado
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatVal(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
