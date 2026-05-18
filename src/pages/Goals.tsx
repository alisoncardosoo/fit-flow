import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Target, Trophy, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { differenceInCalendarDays } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalCard } from "@/components/GoalCard";
import { GoalDialog } from "@/components/GoalDialog";
import { GoalProgressDialog } from "@/components/GoalProgressDialog";
import { BodyMeasurementHistory } from "@/components/BodyMeasurementHistory";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterPill, FilterPillsRow } from "@/components/FilterPill";
import { useGoals, type GoalWithProgress } from "@/hooks/useGoalProgress";
import { celebrate } from "@/lib/celebrate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Filter = "active" | "achieved";

/** Ordenação inteligente: atrasada > urgente > maior progresso > recente. */
function sortActive(list: GoalWithProgress[]): GoalWithProgress[] {
  return [...list].sort((a, b) => {
    const today = new Date();
    const da = a.deadline ? differenceInCalendarDays(new Date(a.deadline), today) : Infinity;
    const db = b.deadline ? differenceInCalendarDays(new Date(b.deadline), today) : Infinity;

    const lateA = da < 0 ? 1 : 0;
    const lateB = db < 0 ? 1 : 0;
    if (lateA !== lateB) return lateB - lateA;

    const urgentA = da >= 0 && da <= 7 ? 1 : 0;
    const urgentB = db >= 0 && db <= 7 ? 1 : 0;
    if (urgentA !== urgentB) return urgentB - urgentA;

    if (urgentA && urgentB) return da - db; // entre urgentes, prazo mais próximo primeiro

    if (b.progress !== a.progress) return b.progress - a.progress; // mais perto de bater
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function Goals() {
  const { goals, loading, reload } = useGoals();
  const [filter, setFilter] = useState<Filter>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalWithProgress | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<GoalWithProgress | null>(null);
  const [progressTarget, setProgressTarget] = useState<GoalWithProgress | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const celebratedRef = useRef<Set<string>>(new Set());

  // Detect newly-achieved goals and celebrate + persist achieved_at
  useEffect(() => {
    (async () => {
      for (const g of goals) {
        if (g.progress >= 1 && !g.achieved_at && !celebratedRef.current.has(g.id)) {
          celebratedRef.current.add(g.id);
          await supabase.from("goals").update({ achieved_at: new Date().toISOString() }).eq("id", g.id);
          celebrate();
          toast.success(`🏆 Meta conquistada: ${g.title}`, { duration: 5000 });
          void reload();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  const active = useMemo(() => sortActive(goals.filter((g) => !g.achieved_at)), [goals]);
  const achieved = useMemo(() => goals.filter((g) => g.achieved_at), [goals]);
  const visible = filter === "active" ? active : achieved;

  // Próxima a bater (active não-conquistada, com maior progresso < 1)
  const closestToWin = useMemo(() => {
    const candidates = active.filter((g) => g.progress < 1);
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => b.progress - a.progress)[0];
  }, [active]);

  function requestDelete(g: GoalWithProgress) {
    setConfirmingDelete(g);
  }

  async function performDelete(g: GoalWithProgress) {
    const { error } = await supabase.from("goals").delete().eq("id", g.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Meta excluída");
    void reload();
  }

  function handleEdit(g: GoalWithProgress) {
    setEditing(g);
    setDialogOpen(true);
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow="Suas conquistas"
        title="Metas"
        subtitle="Defina alvos e acompanhe seu progresso"
        actions={
          <button
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-glow transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nova
          </button>
        }
      />

      {/* Hero summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="card-hero mb-5 rounded-[28px] p-6"
      >
        <motion.div
          className="relative z-10 grid grid-cols-3 gap-3 text-center"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
          }}
        >
          <HeroStat icon={<Target className="h-3.5 w-3.5" />} value={active.length} label="Ativas" />
          <HeroStat icon={<Trophy className="h-3.5 w-3.5" />} value={achieved.length} label="Conquistadas" />
          <HeroStat
            icon={<Zap className="h-3.5 w-3.5" />}
            value={closestToWin ? `${Math.round(closestToWin.progress * 100)}%` : "—"}
            label="Próx. a bater"
          />
        </motion.div>
        {closestToWin && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setProgressTarget(
              closestToWin.type === "bodyweight" || closestToWin.type === "custom" ? closestToWin : null,
            )}
            className="relative z-10 mt-3 block w-full truncate rounded-2xl border border-foreground/10 bg-background/30 px-3 py-2 text-left text-xs font-bold text-foreground/80 backdrop-blur-md transition hover:bg-background/50"
            title={closestToWin.title}
          >
            <span className="text-primary">→ </span>{closestToWin.title}
          </motion.button>
        )}
      </motion.div>

      {/* Filter pills */}
      <FilterPillsRow className="mb-5">
        <FilterPill active={filter === "active"} onClick={() => setFilter("active")}>
          Ativas <span className="opacity-60">· {active.length}</span>
        </FilterPill>
        <FilterPill active={filter === "achieved"} onClick={() => setFilter("achieved")}>
          Conquistadas <span className="opacity-60">· {achieved.length}</span>
        </FilterPill>
      </FilterPillsRow>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-3xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="card-premium rounded-3xl p-8 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {filter === "active" ? "Nenhuma meta ativa. Crie a primeira!" : "Nenhuma meta conquistada ainda."}
          </p>
          {filter === "active" && (
            <Button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="mt-4 h-11 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-glow"
            >
              <Plus className="mr-1 h-4 w-4" /> Criar meta
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 pb-8">
          {visible.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={handleEdit}
              onDelete={requestDelete}
              onLogProgress={(goal) => setProgressTarget(goal)}
              onShowHistory={() => setHistoryOpen(true)}
            />
          ))}
        </div>
      )}

      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reload}
        goal={editing}
      />

      <GoalProgressDialog
        open={!!progressTarget}
        onOpenChange={(o) => !o && setProgressTarget(null)}
        goal={progressTarget}
        onSaved={reload}
      />

      <BodyMeasurementHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onChanged={reload}
      />

      <ConfirmDialog
        open={!!confirmingDelete}
        onOpenChange={(o) => !o && setConfirmingDelete(null)}
        title="Excluir meta?"
        description={confirmingDelete ? `"${confirmingDelete.title}" será removida permanentemente.` : ""}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (confirmingDelete) await performDelete(confirmingDelete);
          setConfirmingDelete(null);
        }}
      />
    </div>
  );
}

// FilterPill local removido — substituído por @/components/FilterPill (compartilhado).

const heroStatVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.92 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 22 } },
};

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <motion.div
      variants={heroStatVariants}
      whileHover={{ y: -2, scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      className="rounded-2xl border border-foreground/10 bg-background/30 p-3 backdrop-blur-md"
    >
      <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 text-primary">{icon}</div>
      <div className="font-display text-base font-extrabold">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-foreground/60">{label}</div>
    </motion.div>
  );
}
