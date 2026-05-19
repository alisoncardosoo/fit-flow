import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Play,
  MoreVertical,
  Edit3,
  Copy,
  Archive,
  Trash2,
  Sparkles,
  Loader2,
  RotateCcw,
  Flame,
  Clock,
  Dumbbell,
  ScanLine,
  History as HistoryIcon,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { ImportWorkoutDialog } from "@/components/ImportWorkoutDialog";
import { FilterPill, FilterPillsRow } from "@/components/FilterPill";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchWorkoutsData, type WorkoutListItem } from "@/services/workouts.service";
import { invalidateWorkoutsCache, refetchWorkoutsCache, workoutsPageKey } from "@/services/workouts.cache";
import { useWorkoutsRealtime } from "@/hooks/useWorkoutsRealtime";

type Workout = WorkoutListItem;

type Filter = "active" | "archived" | "frequent";

const PRESET_COLORS = [
  "#CBFF9A",
  "#7DD3FC",
  "#FCA5A5",
  "#FCD34D",
  "#C4B5FD",
  "#F0ABFC",
];

export default function Workouts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<Workout | null>(null);

  const { data, isLoading: loading, error: loadError, refetch } = useQuery({
    queryKey: workoutsPageKey(user?.id),
    queryFn: fetchWorkoutsData,
    enabled: !!user,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const workouts = data?.workouts ?? [];
  const sessions = data?.sessions ?? [];

  // Mantém a lista sincronizada em tempo real (criação por IA, foto, etc.)
  useWorkoutsRealtime(user?.id);

  const reload = () => invalidateWorkoutsCache(queryClient, user?.id);
  const refetchAndWait = () => refetchWorkoutsCache(queryClient, user?.id);

  // session aggregations
  const sessionStats = useMemo(() => {
    const map = new Map<string, { count: number; lastAt: string }>();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    for (const s of sessions) {
      if (!s.workout_id) continue;
      const cur = map.get(s.workout_id);
      if (!cur) map.set(s.workout_id, { count: 1, lastAt: s.started_at });
      else map.set(s.workout_id, { count: cur.count + 1, lastAt: cur.lastAt });
    }
    const trainedThisWeek = new Set(
      sessions.filter((s) => new Date(s.started_at) >= weekAgo && s.workout_id).map((s) => s.workout_id as string),
    );
    return { map, trainedThisWeek };
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = workouts;
    if (filter === "archived") list = list.filter((w) => w.archived);
    else if (filter === "active") list = list.filter((w) => !w.archived);
    else if (filter === "frequent") {
      list = list.filter((w) => !w.archived);
      list = [...list].sort(
        (a, b) => (sessionStats.map.get(b.id)?.count ?? 0) - (sessionStats.map.get(a.id)?.count ?? 0),
      );
    }
    return list;
  }, [workouts, filter, sessionStats]);

  const heroStats = useMemo(() => {
    const active = workouts.filter((w) => !w.archived).length;
    const week = sessionStats.trainedThisWeek.size;
    return { active, week };
  }, [workouts, sessionStats]);

  async function duplicate(w: Workout) {
    if (!user) return;
    const { data: newW, error } = await supabase
      .from("workouts")
      .insert({ name: `${w.name} (cópia)`, description: w.description, color: w.color, user_id: user.id })
      .select()
      .single();
    if (error || !newW) {
      toast.error("Erro ao duplicar");
      return;
    }
    // Duplicate sheets + their exercises
    const { data: srcSheets } = await supabase
      .from("routine_sheets").select("id, name, description, position").eq("workout_id", w.id).order("position");
    const sheetMap = new Map<string, string>();
    if (srcSheets && srcSheets.length) {
      for (const s of srcSheets) {
        const { data: ns } = await supabase
          .from("routine_sheets")
          .insert({ workout_id: newW.id, name: s.name, description: s.description, position: s.position })
          .select("id").single();
        if (ns) sheetMap.set(s.id, ns.id);
      }
    }
    const { data: src } = await supabase.from("workout_exercises").select("*").eq("workout_id", w.id);
    if (src && src.length) {
      await supabase.from("workout_exercises").insert(
        src.map(({ id: _id, sheet_id, ...rest }) => ({
          ...rest,
          workout_id: newW.id,
          sheet_id: sheet_id ? sheetMap.get(sheet_id) ?? null : null,
        })),
      );
    }
    toast.success("Treino duplicado");
    await refetchAndWait();
  }

  async function archive(id: string) {
    await supabase.from("workouts").update({ archived: true }).eq("id", id);
    toast.success("Treino arquivado");
    await refetchAndWait();
  }

  async function restore(id: string) {
    await supabase.from("workouts").update({ archived: false }).eq("id", id);
    toast.success("Treino restaurado");
    await refetchAndWait();
  }

  async function performDelete(id: string) {
    await supabase.from("workouts").delete().eq("id", id);
    toast.success("Treino excluído");
    await refetchAndWait();
  }

  async function reprocess(w: Workout) {
    const t = toast.loading("Reprocessando treino…");
    try {
      const { data, error } = await supabase.functions.invoke("reprocess-workout", {
        body: { workout_id: w.id },
      });
      if (error) throw error;
      const linked = (data as { linked_exercises?: number })?.linked_exercises ?? 0;
      const generated = (data as { generated_exercises?: number })?.generated_exercises ?? 0;
      if (generated > 0) {
        toast.success(`Treino reconstruído: ${generated} exercícios gerados`, { id: t });
      } else if (linked > 0) {
        toast.success(`Ficha vinculada — ${linked} exercícios restaurados`, { id: t });
      } else {
        toast.success("Treino verificado — já estava correto", { id: t });
      }
      await refetchAndWait();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar", { id: t });
    }
  }

  return (
    <div className="px-5 safe-top pb-dock-fab">
      <PageHeader
        eyebrow="Sua biblioteca"
        title="Treinos"
        subtitle="Organize, edite e inicie suas fichas"
      />

      {/* Hero summary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-hero mb-5 rounded-[28px] p-6"
      >
        <div className="relative z-10 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Ativos</div>
            <div className="font-display text-[40px] leading-none font-extrabold">{heroStats.active}</div>
            <div className="mt-1 text-xs text-foreground/60">treinos prontos</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Esta semana</div>
            <div className="font-display text-[40px] leading-none font-extrabold flex items-baseline gap-1">
              {heroStats.week}
              <Flame className="h-5 w-5 text-warning" />
            </div>
            <div className="mt-1 text-xs text-foreground/60">treinos executados</div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <FilterPillsRow className="mb-4 pt-2 pb-3">
        <FilterPill active={filter === "active"} onClick={() => setFilter("active")}>
          Ativos
        </FilterPill>
        <FilterPill active={filter === "frequent"} onClick={() => setFilter("frequent")}>
          Mais usados
        </FilterPill>
        <FilterPill active={filter === "archived"} onClick={() => setFilter("archived")}>
          Arquivados
        </FilterPill>
      </FilterPillsRow>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-[24px]" />)
        ) : loadError ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-semibold text-destructive">Não foi possível carregar seus treinos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {loadError instanceof Error ? loadError.message : "Erro inesperado"}
            </p>
            <Button onClick={() => void refetch()} className="mt-4 rounded-xl bg-primary font-semibold text-primary-foreground">
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} onCreate={() => setCreateOpen(true)} />
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((w, i) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                index={i}
                trainedThisWeek={sessionStats.trainedThisWeek.has(w.id)}
                lastSessionAt={sessionStats.map.get(w.id)?.lastAt}
                onStart={() => navigate(`/execute/${w.id}`)}
                onEdit={() => navigate(`/workouts/${w.id}`)}
                onDuplicate={() => duplicate(w)}
                onArchive={() => archive(w.id)}
                onRestore={() => restore(w.id)}
                onDelete={() => setConfirmingDelete(w)}
                onReprocess={() => reprocess(w)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* History card */}
      {!loading && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate("/history")}
          className="card-premium mt-6 flex w-full items-center gap-4 rounded-[24px] p-5 text-left transition hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <HistoryIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold leading-tight">Histórico de treinos</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Veja todas as suas sessões finalizadas e progresso
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </motion.button>
      )}

      {/* Scrim — overlays page content (and dock) but stays under the FAB and its action buttons */}
      {fabOpen && (
        <button
          onClick={() => setFabOpen(false)}
          aria-label="Fechar"
          className="fixed inset-0 z-scrim bg-background/40 backdrop-blur-sm"
        />
      )}

      {/* FAB — always above the bottom dock */}
      <div className="fixed right-5 z-fab flex flex-col items-end gap-3 bottom-fab">
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.button
                key="photo"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ delay: 0.05 }}
                onClick={() => { setImportOpen(true); setFabOpen(false); }}
                className="flex h-12 items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-4 text-sm font-bold text-primary backdrop-blur-md shadow-elevated"
              >
                <ScanLine className="h-4 w-4" /> Foto
              </motion.button>
              <motion.button
                key="ai"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ delay: 0.025 }}
                onClick={() => { setAiOpen(true); setFabOpen(false); }}
                className="flex h-12 items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-4 text-sm font-bold text-primary backdrop-blur-md shadow-elevated"
              >
                <Sparkles className="h-4 w-4" /> IA
              </motion.button>
              <motion.button
                key="manual"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                onClick={() => { setCreateOpen(true); setFabOpen(false); }}
                className="flex h-12 items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-4 text-sm font-bold text-primary backdrop-blur-md shadow-elevated"
              >
                <Edit3 className="h-4 w-4" /> Manual
              </motion.button>
            </>
          )}
        </AnimatePresence>
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition hover:scale-[1.05] active:scale-95"
          aria-label={fabOpen ? "Fechar opções" : "Novo treino"}
          aria-expanded={fabOpen}
        >
          <Plus className={cn("h-6 w-6 transition-transform duration-300", fabOpen && "rotate-45")} strokeWidth={2.6} />
        </button>
      </div>

      <CreateWorkoutDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (id) => {
          await refetchAndWait();
          navigate(`/workouts/${id}`);
        }}
      />
      <AIWorkoutDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onCreated={async (id) => {
          await refetchAndWait();
          navigate(`/workouts/${id}`);
        }}
      />
      <ImportWorkoutDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async (id) => {
          await refetchAndWait();
          navigate(`/workouts/${id}`);
        }}
      />

      <ConfirmDialog
        open={!!confirmingDelete}
        onOpenChange={(o) => !o && setConfirmingDelete(null)}
        title="Excluir treino?"
        description={confirmingDelete ? `"${confirmingDelete.name}" e todos os exercícios e fichas serão removidos permanentemente.` : ""}
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (confirmingDelete) await performDelete(confirmingDelete.id);
          setConfirmingDelete(null);
        }}
      />
    </div>
  );
}

// FilterPill local removido — substituído por @/components/FilterPill (compartilhado).

function WorkoutCard({
  workout,
  index,
  trainedThisWeek,
  lastSessionAt,
  onStart,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onReprocess,
}: {
  workout: Workout;
  index: number;
  trainedThisWeek: boolean;
  lastSessionAt?: string;
  onStart: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onReprocess: () => void;
}) {
  const exCount = workout.workout_exercises?.length ?? 0;
  const sheetCount = workout.routine_sheets?.length ?? 0;
  const orphanCount = (workout.workout_exercises ?? []).filter((e) => !e.sheet_id).length;
  const needsReprocess = !workout.archived && (sheetCount === 0 || orphanCount > 0);
  const estimatedMinutes = useMemo(() => {
    const sec = (workout.workout_exercises ?? []).reduce(
      (acc, e) => acc + e.target_sets * (e.target_reps * 3 + e.rest_seconds),
      0,
    );
    return Math.max(1, Math.round(sec / 60));
  }, [workout.workout_exercises]);

  const accent = workout.color ?? PRESET_COLORS[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.04 }}
      className="card-premium relative overflow-hidden rounded-[24px] p-5"
    >
      {/* Color accent stripe */}
      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: `linear-gradient(180deg, ${accent}, ${accent}55)` }}
      />

      <div className="flex items-start justify-between gap-3 pl-2">
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <div className="font-display text-lg font-bold leading-tight truncate">{workout.name}</div>
            {trainedThisWeek && !workout.archived && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                <Flame className="h-3 w-3" /> Esta semana
              </span>
            )}
            {needsReprocess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <Wand2 className="h-3 w-3" /> Reprocessar
              </span>
            )}
          </div>
          {workout.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{workout.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" />
              {exCount} {exCount === 1 ? "exercício" : "exercícios"}
            </span>
            {sheetCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                {sheetCount} {sheetCount === 1 ? "ficha" : "fichas"}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />~{estimatedMinutes} min
            </span>
            {lastSessionAt && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                {formatDistanceToNow(new Date(lastSessionAt), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Mais opções"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-2xl border-border bg-card">
            {!workout.archived && (
              <>
                <DropdownMenuItem onClick={onEdit} className="rounded-xl">
                  <Edit3 className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} className="rounded-xl">
                  <Copy className="mr-2 h-4 w-4" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onReprocess} className="rounded-xl">
                  <Wand2 className="mr-2 h-4 w-4" /> Reprocessar com IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onArchive} className="rounded-xl">
                  <Archive className="mr-2 h-4 w-4" /> Arquivar
                </DropdownMenuItem>
              </>
            )}
            {workout.archived && (
              <>
                <DropdownMenuItem onClick={onRestore} className="rounded-xl">
                  <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} className="rounded-xl">
                  <Copy className="mr-2 h-4 w-4" /> Duplicar
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="rounded-xl text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!workout.archived && exCount > 0 && (
        <Button
          onClick={onStart}
          className="mt-4 h-11 w-full rounded-2xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 shadow-glow"
        >
          <Play className="mr-1.5 h-4 w-4 fill-current" /> Iniciar treino
        </Button>
      )}
      {!workout.archived && exCount === 0 && (
        <Button
          onClick={onEdit}
          variant="outline"
          className="mt-4 h-11 w-full rounded-2xl border-border bg-secondary font-semibold"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar exercícios
        </Button>
      )}
    </motion.div>
  );
}

function EmptyState({ filter, onCreate }: { filter: Filter; onCreate: () => void }) {
  if (filter === "archived") {
    return (
      <div className="rounded-3xl border border-dashed border-border p-12 text-center">
        <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhum treino arquivado.</p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center">
      <Dumbbell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Você ainda não tem treinos.</p>
      <Button onClick={onCreate} className="mt-4 rounded-xl bg-primary font-semibold text-primary-foreground">
        <Plus className="mr-1 h-4 w-4" /> Criar primeiro treino
      </Button>
    </div>
  );
}

function CreateWorkoutDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { data, error } = await supabase
      .from("workouts")
      .insert({ name: name.trim(), color, user_id: user.id })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Erro ao criar");
      return;
    }
    setName("");
    setColor(PRESET_COLORS[0]);
    onCreated(data.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Novo treino</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nome
            </label>
            <Input
              autoFocus
              placeholder="Treino A — Peito e Tríceps"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-2xl bg-secondary text-base font-semibold"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-10 w-10 rounded-full border-2 transition",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={save}
            disabled={!name.trim() || saving}
            className="h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 shadow-glow"
          >
            {saving ? "Criando…" : "Criar e adicionar exercícios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AIWorkoutDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [focus, setFocus] = useState("Peito e tríceps");
  const [duration, setDuration] = useState(60);
  const [equipment, setEquipment] = useState("Academia completa");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-workout", {
        body: { focus, duration, equipment },
      });
      if (error) throw error;
      if (data?.workout_id) {
        toast.success("Treino gerado pela IA!");
        onCreated(data.workout_id);
      } else {
        throw new Error("Falha");
      }
    } catch {
      toast.error("Erro ao gerar treino");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-primary" /> Gerar com IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Foco do treino">
            <Input value={focus} onChange={(e) => setFocus(e.target.value)} className="h-11 rounded-xl bg-secondary" />
          </Field>
          <Field label="Duração (min)">
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-11 rounded-xl bg-secondary"
            />
          </Field>
          <Field label="Equipamento disponível">
            <Input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="h-11 rounded-xl bg-secondary"
            />
          </Field>
          <Button
            onClick={generate}
            disabled={loading}
            className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 shadow-glow"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando…
              </>
            ) : (
              <>Gerar treino</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
