import { motion } from "framer-motion";
import {
  Trophy, Target, Dumbbell, Flame, Calendar, MoreVertical, Trash2, Edit3, Sparkles,
  Plus, History, Clock, AlertCircle, Scale, TrendingUp, TrendingDown, Minus,
  type LucideIcon,
} from "lucide-react";
import type { GoalWithProgress } from "@/hooks/useGoalProgress";
import { useGoalHistory } from "@/hooks/useGoalHistory";
import { GoalSparkline } from "@/components/GoalSparkline";
import { inferGoalTrend, type TrendStatus } from "@/lib/goalTrend";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeMeta: Record<string, { icon: LucideIcon; label: string }> = {
  bodyweight: { icon: Scale, label: "Peso corporal" },
  exercise_load: { icon: Dumbbell, label: "Carga" },
  weekly_frequency: { icon: Flame, label: "Semana" },
  monthly_frequency: { icon: Calendar, label: "Mês" },
  custom: { icon: Sparkles, label: "Personalizada" },
};

interface Props {
  goal: GoalWithProgress;
  onEdit: (g: GoalWithProgress) => void;
  onDelete: (g: GoalWithProgress) => void;
  onLogProgress?: (g: GoalWithProgress) => void;
  onShowHistory?: (g: GoalWithProgress) => void;
}

export function GoalCard({ goal, onEdit, onDelete, onLogProgress, onShowHistory }: Props) {
  const meta = typeMeta[goal.type] ?? typeMeta.custom;
  const Icon = meta.icon;
  const pct = Math.round(goal.progress * 100);
  const achieved = !!goal.achieved_at || pct >= 100;
  const canLog = goal.type === "bodyweight" || goal.type === "custom";
  const showHistory = goal.type === "bodyweight";

  // Deadline state
  const daysLeft = goal.deadline ? differenceInCalendarDays(new Date(goal.deadline), new Date()) : null;
  const isLate = !achieved && daysLeft != null && daysLeft < 0;
  const isUrgent = !achieved && daysLeft != null && daysLeft >= 0 && daysLeft <= 7;

  // Pace required: per week to hit target
  const remainingWeeks = daysLeft != null && daysLeft > 0 ? daysLeft / 7 : null;
  const remainingValue = Number(goal.target_value) - Number(goal.current_value);
  const pacePerWeek = remainingWeeks && remainingWeeks > 0 ? remainingValue / remainingWeeks : null;
  const showPace = !achieved && pacePerWeek != null && Math.abs(pacePerWeek) > 0.01;

  // Trend (improving / stagnant / regressing)
  const trend = inferGoalTrend(goal);
  const showTrendBadge = trend && trend.status !== "achieved";

  // Sparkline history (last 60d) — only for trackable types.
  const showSparkline = goal.type !== "custom" && !achieved;
  const { data: history } = useGoalHistory(showSparkline ? goal : null);
  const sparkVariant: "improving" | "stagnant" | "regressing" | "neutral" =
    trend && trend.status !== "achieved" ? trend.status : "neutral";

  // Ideal pace line: linear from start_value (created_at) to target_value (deadline).
  // Sampled on the same dates as the actual history so it overlays cleanly.
  const idealLine = (() => {
    if (!showSparkline || !history || history.length < 2) return undefined;
    const start = new Date(goal.created_at).getTime();
    const end = goal.deadline
      ? new Date(goal.deadline).getTime()
      : start + 90 * 24 * 60 * 60 * 1000;
    if (end <= start) return undefined;
    const startVal = Number(goal.start_value);
    const targetVal = Number(goal.target_value);
    return history.map((p) => {
      const t = new Date(p.date).getTime();
      const ratio = Math.max(0, Math.min(1, (t - start) / (end - start)));
      return { date: p.date, value: startVal + (targetVal - startVal) * ratio };
    });
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-premium relative overflow-hidden rounded-3xl p-5 ${
        achieved ? "border-primary/40 bg-primary/5" : isLate ? "border-destructive/30" : ""
      }`}
    >
      {achieved && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      )}

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              achieved ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-primary"
            }`}
          >
            {achieved ? <Trophy className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="pill text-[10px]">{meta.label}</span>
              {achieved && (
                <span className="pill bg-primary text-[10px] text-primary-foreground">✓ Conquistada</span>
              )}
              {isLate && (
                <span className="pill bg-destructive/15 text-[10px] text-destructive">
                  <AlertCircle className="mr-1 inline h-2.5 w-2.5" />
                  Atrasada
                </span>
              )}
              {isUrgent && !isLate && (
                <span className="pill bg-warning/15 text-[10px] text-warning">
                  <Clock className="mr-1 inline h-2.5 w-2.5" />
                  {daysLeft === 0 ? "Hoje" : `${daysLeft}d`}
                </span>
              )}
              {showTrendBadge && <TrendBadge status={trend!.status} label={trend!.label} />}
            </div>
            <h3 className="mt-1.5 truncate font-display text-base font-extrabold tracking-tight">
              {goal.title}
            </h3>
            {goal.exercise_name && (
              <p className="text-xs text-muted-foreground">{goal.exercise_name}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canLog && onLogProgress && (
              <DropdownMenuItem onClick={() => onLogProgress(goal)}>
                <Plus className="mr-2 h-4 w-4" /> Registrar progresso
              </DropdownMenuItem>
            )}
            {showHistory && onShowHistory && (
              <DropdownMenuItem onClick={() => onShowHistory(goal)}>
                <History className="mr-2 h-4 w-4" /> Ver histórico
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(goal)}>
              <Edit3 className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(goal)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative z-10 mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="font-display text-2xl font-extrabold">
            {formatNumber(goal.current_value)}
            <span className="text-sm font-bold text-muted-foreground">
              {" "}/ {formatNumber(goal.target_value)} {goal.unit}
            </span>
          </div>
          <div className={`text-sm font-extrabold ${achieved ? "text-primary" : ""}`}>{pct}%</div>
        </div>
        <Progress value={pct} className="h-2.5 rounded-full" />

        {/* Linha de status (prazo / ritmo / conquista) */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
          {goal.deadline && !achieved && (
            <span className={isLate ? "text-destructive" : ""}>
              {isLate
                ? `${Math.abs(daysLeft!)} ${Math.abs(daysLeft!) === 1 ? "dia" : "dias"} de atraso`
                : daysLeft === 0
                  ? "Termina hoje"
                  : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} · ${format(new Date(goal.deadline), "d 'de' MMM", { locale: ptBR })}`}
            </span>
          )}
          {!goal.deadline && !achieved && <span>Sem prazo definido</span>}
          {showPace && (
            <span className="font-bold text-primary">
              {pacePerWeek! > 0 ? "+" : ""}
              {pacePerWeek!.toFixed(1)} {goal.unit}/sem
            </span>
          )}
          {achieved && goal.achieved_at && (
            <span className="font-bold text-primary">
              🎉 {format(new Date(goal.achieved_at), "d 'de' MMM", { locale: ptBR })}
            </span>
          )}
        </div>

        {/* Sparkline — tendência dos últimos 60 dias */}
        {showSparkline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mt-3 -mx-1"
          >
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Últimos 60 dias</span>
              {history && history.length >= 2 && (
                <span>
                  {formatNumber(history[0].value)} → {formatNumber(history[history.length - 1].value)} {goal.unit}
                </span>
              )}
            </div>
            <GoalSparkline
              data={history ?? []}
              variant={sparkVariant}
              unit={goal.unit}
              targetValue={Number(goal.target_value)}
              idealLine={idealLine}
              height={44}
            />
          </motion.div>
        )}

        {/* Atalho de ação para metas manuais */}
        {canLog && !achieved && onLogProgress && (
          <button
            onClick={() => onLogProgress(goal)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-primary transition hover:bg-primary/20"
          >
            <Plus className="h-3 w-3" />
            {goal.type === "bodyweight" ? "Registrar peso de hoje" : "Atualizar progresso"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function formatNumber(n: number) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const trendStyles: Record<TrendStatus, { className: string; Icon: LucideIcon; pulse?: boolean }> = {
  improving: {
    className: "bg-success/15 text-success ring-1 ring-success/25",
    Icon: TrendingUp,
  },
  stagnant: {
    className: "bg-muted text-muted-foreground ring-1 ring-border",
    Icon: Minus,
  },
  regressing: {
    className: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
    Icon: TrendingDown,
    pulse: true,
  },
  achieved: {
    className: "bg-primary text-primary-foreground",
    Icon: Trophy,
  },
};

function TrendBadge({ status, label }: { status: TrendStatus; label: string }) {
  const style = trendStyles[status];
  const Icon = style.Icon;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.05 }}
      whileHover={{ scale: 1.06 }}
      className={`pill inline-flex items-center gap-1 text-[10px] font-bold ${style.className}`}
      aria-label={`Tendência: ${label}`}
    >
      <motion.span
        animate={
          status === "improving"
            ? { y: [0, -1.5, 0] }
            : status === "regressing"
              ? { y: [0, 1.5, 0] }
              : { rotate: 0 }
        }
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="inline-flex"
      >
        <Icon className="h-2.5 w-2.5" />
      </motion.span>
      {label}
      {style.pulse && (
        <span className="relative ml-0.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
        </span>
      )}
    </motion.span>
  );
}
