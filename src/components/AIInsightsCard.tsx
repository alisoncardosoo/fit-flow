import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, TrendingUp, AlertTriangle, Lightbulb, Trophy,
  Loader2, RefreshCw, Check, Target, Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { invalidateWorkoutsCache, refetchWorkoutsCache } from "@/services/workouts.cache";

type AIInsight = { icon: "trend" | "alert" | "tip" | "win"; title: string; body: string };
type AIAction =
  | { kind: "adjust_weekly_target"; weekly_target: number }
  | { kind: "generate_workout"; focus: string; duration_minutes: number; equipment: string }
  | null;
type AIRecommendation = { text: string; action: AIAction };
type AIResponse = {
  summary: string;
  insights: AIInsight[];
  recommendations: AIRecommendation[];
  forecast: { next_30_days_volume_pct: number; next_pr_exercise: string | null; rationale: string };
  generated_at?: string;
  cached?: boolean;
};

const ICONS = {
  trend: TrendingUp,
  alert: AlertTriangle,
  tip: Lightbulb,
  win: Trophy,
} as const;

const TONES = {
  trend: "border-primary/30 bg-primary/5 text-primary",
  alert: "border-destructive/30 bg-destructive/5 text-destructive",
  tip: "border-warning/30 bg-warning/5 text-warning",
  win: "border-primary/30 bg-primary/10 text-primary",
} as const;

export function AIInsightsCard() {
  const [data, setData] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    void load(false);
  }, []);

  async function load(force: boolean) {
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke<AIResponse>("ai-insights", {
        body: { force },
      });
      if (err) throw err;
      if (!res || (res as unknown as { error?: string }).error) {
        const msg = (res as unknown as { error?: string })?.error ?? "Erro ao gerar insights";
        throw new Error(msg);
      }
      setData(res);
      if (force) toast.success("Análise atualizada");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setError(msg);
      if (msg.includes("Limite") || msg.includes("Créditos")) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function applyRecommendation(idx: number, rec: AIRecommendation) {
    if (!rec.action || appliedIdx.has(idx) || applyingIdx !== null) return;
    setApplyingIdx(idx);
    try {
      if (rec.action.kind === "adjust_weekly_target") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");
        const { error: e } = await supabase
          .from("profiles")
          .update({ weekly_target: rec.action.weekly_target })
          .eq("user_id", user.id);
        if (e) throw e;
        setAppliedIdx((s) => new Set(s).add(idx));
        toast.success(`Meta semanal ajustada para ${rec.action.weekly_target} treinos`);
      } else if (rec.action.kind === "generate_workout") {
        const { focus, duration_minutes, equipment } = rec.action;
        toast.loading("Gerando treino com IA…", { id: "gen-workout" });
        const { data: { user } } = await supabase.auth.getUser();
        const { data: res, error: e } = await supabase.functions.invoke<{ workout_id?: string; error?: string }>(
          "generate-workout",
          { body: { focus, duration: duration_minutes, equipment } },
        );
        toast.dismiss("gen-workout");
        if (e || res?.error || !res?.workout_id) throw new Error(res?.error ?? "Falha ao gerar treino");
        // Atualiza a lista de treinos antes de navegar para que o novo treino apareça
        invalidateWorkoutsCache(queryClient, user?.id);
        await refetchWorkoutsCache(queryClient, user?.id);
        setAppliedIdx((s) => new Set(s).add(idx));
        toast.success("Treino criado! Abrindo editor…");
        setTimeout(() => navigate(`/workouts/${res.workout_id}`), 600);
      }
    } catch (e) {
      toast.dismiss("gen-workout");
      toast.error(e instanceof Error ? e.message : "Não foi possível aplicar");
    } finally {
      setApplyingIdx(null);
    }
  }

  const busy = loading || refreshing;

  return (
    <div className="card-premium rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <Sparkles className="h-4 w-4 text-primary" />
            {!busy && <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
          </div>
          <h3 className="font-display text-lg font-bold">Análise IA</h3>
          {data?.generated_at && !loading && (
            <span className="truncate text-[10px] font-medium text-muted-foreground">
              · {formatDistanceToNow(new Date(data.generated_at), { locale: ptBR, addSuffix: true })}
            </span>
          )}
        </div>
        <button
          onClick={() => void load(true)}
          disabled={busy}
          className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
          aria-label="Atualizar"
          title="Gerar nova análise"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-5 w-3/4 rounded-lg" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && data && (
        <AnimatePresence mode="wait">
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Summary */}
            <p className="font-display text-base font-semibold leading-snug text-foreground">
              {data.summary}
            </p>

            {/* Insights */}
            <div className="space-y-2">
              {data.insights.map((ins, i) => {
                const Icon = ICONS[ins.icon];
                const tone = TONES[ins.icon];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`flex items-start gap-3 rounded-2xl border p-3 ${tone}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-foreground">{ins.title}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{ins.body}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Plano para 7 dias
                </div>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, i) => {
                    const applied = appliedIdx.has(i);
                    const applying = applyingIdx === i;
                    const ActionIcon = rec.action?.kind === "adjust_weekly_target" ? Target : Wand2;
                    const actionLabel =
                      rec.action?.kind === "adjust_weekly_target"
                        ? `Ajustar para ${rec.action.weekly_target}/sem`
                        : rec.action?.kind === "generate_workout"
                          ? "Gerar treino"
                          : null;

                    return (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        className="rounded-2xl border border-border/60 bg-secondary/40 p-3"
                      >
                        <div className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                          <span className="flex-1">{rec.text}</span>
                        </div>
                        {actionLabel && (
                          <button
                            onClick={() => void applyRecommendation(i, rec)}
                            disabled={applied || applying || applyingIdx !== null}
                            className={`mt-2 ml-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                              applied
                                ? "bg-primary/15 text-primary"
                                : "bg-primary text-primary-foreground hover:scale-[1.02] disabled:opacity-50"
                            }`}
                          >
                            {applying ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : applied ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <ActionIcon className="h-3 w-3" />
                            )}
                            {applied ? "Aplicado" : applying ? "Aplicando…" : actionLabel}
                          </button>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Forecast */}
            <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" /> Previsão 30 dias
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-foreground">
                  {data.forecast.next_30_days_volume_pct > 0 ? "+" : ""}
                  {data.forecast.next_30_days_volume_pct.toFixed(0)}%
                </span>
                <span className="text-xs text-muted-foreground">de volume</span>
              </div>
              {data.forecast.next_pr_exercise && (
                <div className="mt-1 text-xs text-foreground/80">
                  Próximo PR esperado em <span className="font-bold text-primary">{data.forecast.next_pr_exercise}</span>
                </div>
              )}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.forecast.rationale}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
