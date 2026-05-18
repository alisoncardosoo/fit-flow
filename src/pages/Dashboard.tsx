import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Play, TrendingUp, Calendar, Plus, Sparkles, Trophy, Share2, ArrowUpRight, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthlyGoalCard } from "@/components/MonthlyGoalCard";
import { SocialRankingCard } from "@/components/SocialRankingCard";
import { LiveFriendsCard } from "@/components/LiveFriendsCard";
import { NotificationBell } from "@/components/NotificationBell";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchDashboardData, fetchMotivation } from "@/services/dashboard.service";
import { PageHeader } from "@/components/PageHeader";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboardData(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });

  const profile = data?.profile ?? null;
  const streak = data?.streak ?? 0;
  const nextWorkout = data?.nextWorkout ?? null;
  const lastSession = data?.lastSession ?? null;
  const weekCount = data?.weekCount ?? 0;
  const weekVolume = data?.weekVolume ?? 0;

  // Redirect to onboarding if profile not yet onboarded
  useEffect(() => {
    if (data && profile && !profile.onboarded) {
      navigate("/onboarding");
    }
  }, [data, profile, navigate]);

  const motivationEnabled = !!user && !!data && !!profile?.onboarded;
  const { data: motivation = "" } = useQuery({
    queryKey: [
      "motivation",
      user?.id,
      streak,
      weekCount,
      profile?.weekly_target ?? 4,
      profile?.display_name ?? "",
    ],
    queryFn: () =>
      fetchMotivation({
        streak,
        weekCount,
        weeklyTarget: profile?.weekly_target ?? 4,
        name: profile?.display_name ?? "",
      }).catch(() => getFallbackMotivation(streak)),
    enabled: motivationEnabled,
    staleTime: 60 * 60 * 1000, // cache 1h — only refresh if inputs change
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const greeting = getGreeting();
  const firstName = profile?.display_name?.split(" ")[0] ?? "atleta";

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow={greeting}
        title={firstName}
        actions={
          <>
            <NotificationBell />
            <Link
              to="/share"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition hover:text-primary"
              title="Compartilhar evolução"
            >
              <Share2 className="h-[18px] w-[18px]" />
            </Link>
            <div className="flex h-10 items-center gap-2 rounded-full bg-secondary px-3">
              <Flame className={`h-[18px] w-[18px] ${streak > 0 ? "text-warning" : "text-muted-foreground"}`} />
              <span className="font-bold text-sm">{streak}</span>
            </div>
          </>
        }
      />

      {/* Motivation */}
      {motivation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed">{motivation}</p>
        </motion.div>
      )}

      {/* Next workout — atmospheric hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-hero mb-6 rounded-[28px] p-6"
      >
        <div className="relative z-10">
          <span className="pill mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Próximo treino
          </span>
          <h2 className="font-display text-[32px] leading-[1.05] font-bold tracking-tight text-foreground">
            {nextWorkout?.name ?? "Crie seu primeiro treino"}
          </h2>
          {nextWorkout?.description && (
            <p className="mt-2 text-sm text-foreground/70">{nextWorkout.description}</p>
          )}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => nextWorkout ? navigate(`/execute/${nextWorkout.id}`) : navigate("/workouts")}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground shadow-glow transition hover:scale-[1.02] active:scale-[0.98]"
            >
              {nextWorkout ? <><Play className="h-4 w-4 fill-current" /> Iniciar</> : <><Plus className="h-4 w-4" /> Criar treino</>}
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
            <Link to="/workouts" className="inline-flex h-12 items-center rounded-full border border-foreground/15 px-5 text-[14px] font-semibold text-foreground/90 backdrop-blur-sm transition hover:bg-foreground/5">
              Meus treinos
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Esta semana"
          value={`${weekCount}/${profile?.weekly_target ?? 4}`}
          sub="treinos"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Volume"
          value={`${(weekVolume / 1000).toFixed(1)}t`}
          sub="esta semana"
        />
      </div>

      {/* Last workout */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-3xl" />
      ) : lastSession ? (
        <Link to="/history" className="block card-premium rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Último treino</p>
          <h3 className="mt-1 font-semibold">{lastSession.workout_name}</h3>
          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span>{format(new Date(lastSession.started_at), "d 'de' MMM", { locale: ptBR })}</span>
            <span>·</span>
            <span>{Math.round((lastSession.duration_seconds ?? 0) / 60)} min</span>
            <span>·</span>
            <span>{Number(lastSession.total_volume ?? 0).toLocaleString("pt-BR")} kg</span>
          </div>
        </Link>
      ) : (
        <div className="card-premium rounded-3xl p-5 text-center">
          <p className="text-sm text-muted-foreground">Nenhum treino ainda. Vamos começar?</p>
        </div>
      )}

      {/* Monthly goal */}
      <div className="mt-6">
        <MonthlyGoalCard />
      </div>

      {/* Live friends + Social ranking */}
      <div className="mt-4 space-y-3">
        <LiveFriendsCard />
        <SocialRankingCard />
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/goals" className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card p-4 text-xs font-semibold transition hover:border-primary/40">
          <Target className="h-4 w-4 text-primary" /> Metas
        </Link>
        <Link to="/achievements" className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card p-4 text-xs font-semibold transition hover:border-primary/40">
          <Trophy className="h-4 w-4 text-primary" /> Medalhas
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card-premium rounded-2xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getFallbackMotivation(streak: number): string {
  if (streak === 0) return "Hora de voltar ao ritmo. Um treino de cada vez 💪";
  if (streak < 3) return `${streak} ${streak === 1 ? "dia" : "dias"} consecutivos. Continue assim!`;
  if (streak < 7) return `🔥 ${streak} dias seguidos. Você está pegando ritmo!`;
  return `🔥🔥 ${streak} dias consecutivos. Você é uma máquina!`;
}
