import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { invalidateWorkoutsCache } from "@/services/workouts.cache";
import {
  ArrowLeft, GripVertical, Trash2, Plus, Play, Search, Copy, Palette, MoreVertical,
  CopyPlus, Pencil, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseImagePicker } from "@/components/ExerciseImagePicker";
import { getUserOverride } from "@/lib/exerciseImageCache";
import { ImagePlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  type RoutineSheet, listSheets, createSheet, renameSheet, deleteSheet, duplicateSheet,
  reorderSheets, nextSheetName,
} from "@/lib/sheets";

const PRESET_COLORS = ["#CBFF9A", "#7DD3FC", "#FCA5A5", "#FCD34D", "#C4B5FD", "#F0ABFC"];

type Exercise = { id: string; name: string; muscle_group: string; equipment: string; image_url?: string | null };
type WE = {
  id: string;
  exercise_id: string;
  sheet_id: string | null;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight: number | null;
  rest_seconds: number;
  exercises: Exercise;
};

export default function WorkoutEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [sheets, setSheets] = useState<RoutineSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [items, setItems] = useState<WE[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePickerFor, setImagePickerFor] = useState<{ id: string; name: string; hasImage: boolean } | null>(null);
  const [renameDialog, setRenameDialog] = useState<RoutineSheet | null>(null);
  const [confirmingDeleteSheet, setConfirmingDeleteSheet] = useState<RoutineSheet | null>(null);
  // Defaults para novos exercícios — vêm das configurações do perfil.
  const [exerciseDefaults, setExerciseDefaults] = useState<{
    sets: number;
    reps: number;
    rest: number;
  }>({ sets: 3, reps: 10, rest: 60 });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Carrega defaults configurados em Perfil (séries / reps / descanso).
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("default_sets, default_reps, default_rest_seconds")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      setExerciseDefaults({
        sets: data.default_sets ?? 3,
        reps: data.default_reps ?? 10,
        rest: data.default_rest_seconds ?? 60,
      });
    })();
  }, [user]);

  async function load(opts?: { silent?: boolean }) {
    if (!id) return;
    if (!opts?.silent) setLoading(true);
    const [{ data: w }, sheetList, { data: we }] = await Promise.all([
      supabase.from("workouts").select("name, color").eq("id", id).maybeSingle(),
      listSheets(id),
      supabase
        .from("workout_exercises")
        .select("*, exercises(id, name, muscle_group, equipment, image_url)")
        .eq("workout_id", id)
        .order("position", { ascending: true }),
    ]);
    if (w) {
      setName(w.name);
      setColor(w.color ?? PRESET_COLORS[0]);
    }
    setSheets(sheetList);
    const loaded = (we as WE[]) ?? [];
    setItems(loaded);

    // Auto-repair: treino sem ficha mas com exercícios órfãos OU sem ficha
    const hasOrphans = loaded.some((it) => !it.sheet_id);
    if ((sheetList.length === 0 && loaded.length > 0) || (sheetList.length === 0) || hasOrphans) {
      try {
        const { data: rep, error } = await supabase.functions.invoke("reprocess-workout", {
          body: { workout_id: id },
        });
        if (!error && rep) {
          const linked = (rep as { linked_exercises?: number }).linked_exercises ?? 0;
          const generated = (rep as { generated_exercises?: number }).generated_exercises ?? 0;
          if (linked > 0 || generated > 0) {
            // Recarregar dados após reparo (silencioso)
            const [sheetList2, { data: we2 }] = await Promise.all([
              listSheets(id),
              supabase
                .from("workout_exercises")
                .select("*, exercises(id, name, muscle_group, equipment, image_url)")
                .eq("workout_id", id)
                .order("position", { ascending: true }),
            ]);
            setSheets(sheetList2);
            setItems((we2 as WE[]) ?? []);
            const fromUrl = searchParams.get("sheet");
            const initial = fromUrl && sheetList2.some((s) => s.id === fromUrl)
              ? fromUrl
              : sheetList2[0]?.id ?? null;
            setActiveSheetId(initial);
            // Garante que a aba de Treinos reflita o reparo ao voltar
            invalidateWorkoutsCache(queryClient, user?.id);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("auto-reprocess failed", err);
      }
    }

    // Determine active sheet from URL or first
    const fromUrl = searchParams.get("sheet");
    const initial = fromUrl && sheetList.some((s) => s.id === fromUrl)
      ? fromUrl
      : sheetList[0]?.id ?? null;
    setActiveSheetId(initial);
    setLoading(false);
  }

  // sync URL when active sheet changes
  useEffect(() => {
    if (!activeSheetId) return;
    const params = new URLSearchParams(searchParams);
    params.set("sheet", activeSheetId);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetId]);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const sheetItems = useMemo(
    () => items.filter((i) => i.sheet_id === activeSheetId).sort((a, b) => a.position - b.position),
    [items, activeSheetId],
  );

  const exerciseCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) if (it.sheet_id) map[it.sheet_id] = (map[it.sheet_id] ?? 0) + 1;
    return map;
  }, [items]);

  async function saveName() {
    if (!id) return;
    await supabase.from("workouts").update({ name }).eq("id", id);
  }

  async function saveColor(c: string) {
    setColor(c);
    if (!id) return;
    await supabase.from("workouts").update({ color: c }).eq("id", id);
  }

  /* ---------------- SHEETS ---------------- */
  async function handleAddSheet() {
    if (!id) return;
    const newName = nextSheetName(sheets);
    try {
      const created = await createSheet(id, newName, sheets.length);
      setSheets((cur) => [...cur, created]);
      setActiveSheetId(created.id);
      toast.success(`Ficha ${newName} criada`);
    } catch {
      toast.error("Erro ao criar ficha");
    }
  }

  async function handleDuplicateSheet(s: RoutineSheet) {
    try {
      const created = await duplicateSheet(s.id);
      await load();
      setActiveSheetId(created.id);
      toast.success("Ficha duplicada");
    } catch {
      toast.error("Erro ao duplicar");
    }
  }

  function handleDeleteSheet(s: RoutineSheet) {
    if (sheets.length === 1) {
      toast.error("O treino precisa de ao menos 1 ficha");
      return;
    }
    setConfirmingDeleteSheet(s);
  }

  async function performDeleteSheet(s: RoutineSheet) {
    await deleteSheet(s.id);
    const remaining = sheets.filter((x) => x.id !== s.id);
    setSheets(remaining);
    setItems((cur) => cur.filter((i) => i.sheet_id !== s.id));
    if (activeSheetId === s.id) setActiveSheetId(remaining[0]?.id ?? null);
    toast.success("Ficha excluída");
  }

  async function handleRenameSheet(s: RoutineSheet, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await renameSheet(s.id, trimmed);
    setSheets((cur) => cur.map((x) => (x.id === s.id ? { ...x, name: trimmed } : x)));
    setRenameDialog(null);
    toast.success("Ficha renomeada");
  }

  function navSheet(direction: 1 | -1) {
    if (!activeSheetId) return;
    const idx = sheets.findIndex((s) => s.id === activeSheetId);
    const next = idx + direction;
    if (next < 0 || next >= sheets.length) return;
    setActiveSheetId(sheets[next].id);
  }

  /* ---------------- EXERCISES ---------------- */
  async function addExercise(ex: Exercise) {
    if (!id || !activeSheetId) {
      toast.error("Crie uma ficha primeiro");
      return;
    }
    const { data, error } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: id,
        sheet_id: activeSheetId,
        exercise_id: ex.id,
        position: sheetItems.length,
        target_sets: exerciseDefaults.sets,
        target_reps: exerciseDefaults.reps,
        target_weight: 0,
        rest_seconds: exerciseDefaults.rest,
      })
      .select("*, exercises(id, name, muscle_group, equipment, image_url)")
      .single();
    if (error || !data) {
      toast.error("Erro");
      return;
    }
    setItems((cur) => [...cur, data as WE]);
    setPickerOpen(false);
  }

  async function duplicateItem(item: WE) {
    if (!id || !activeSheetId) return;
    const { data, error } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: id,
        sheet_id: activeSheetId,
        exercise_id: item.exercise_id,
        position: sheetItems.length,
        target_sets: item.target_sets,
        target_reps: item.target_reps,
        target_weight: item.target_weight,
        rest_seconds: item.rest_seconds,
      })
      .select("*, exercises(id, name, muscle_group, equipment, image_url)")
      .single();
    if (error || !data) {
      toast.error("Erro ao duplicar");
      return;
    }
    setItems((cur) => [...cur, data as WE]);
    toast.success("Exercício duplicado");
  }

  async function removeItem(weId: string) {
    await supabase.from("workout_exercises").delete().eq("id", weId);
    setItems((cur) => cur.filter((i) => i.id !== weId));
  }

  type EditableField = "target_sets" | "target_reps" | "target_weight" | "rest_seconds";
  async function updateField(weId: string, field: EditableField, value: number) {
    setItems((cur) => cur.map((i) => (i.id === weId ? { ...i, [field]: value } : i)));
    if (field === "target_sets") await supabase.from("workout_exercises").update({ target_sets: value }).eq("id", weId);
    else if (field === "target_reps") await supabase.from("workout_exercises").update({ target_reps: value }).eq("id", weId);
    else if (field === "target_weight") await supabase.from("workout_exercises").update({ target_weight: value }).eq("id", weId);
    else if (field === "rest_seconds") await supabase.from("workout_exercises").update({ rest_seconds: value }).eq("id", weId);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sheetItems.findIndex((i) => i.id === active.id);
    const newIdx = sheetItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(sheetItems, oldIdx, newIdx);
    // optimistic update — merge back into items
    setItems((cur) => {
      const others = cur.filter((i) => i.sheet_id !== activeSheetId);
      return [...others, ...reordered.map((it, idx) => ({ ...it, position: idx }))];
    });
    await Promise.all(
      reordered.map((it, idx) => supabase.from("workout_exercises").update({ position: idx }).eq("id", it.id)),
    );
  }

  /* ---------------- SWIPE between sheets ---------------- */
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => navSheet(1),
    onSwipedRight: () => navSheet(-1),
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 60,
  });

  return (
    <div className="px-5 safe-top">
      {/* Header */}
      <PageHeader
        eyebrow="Editando treino"
        title={name || "Treino"}
        backTo="/workouts"
        actions={
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary"
                aria-label="Cor do treino"
              >
                <span className="h-5 w-5 rounded-full border border-foreground/10" style={{ background: color }} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto rounded-2xl border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Palette className="h-3 w-3" /> Cor
              </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => saveColor(c)}
                      className={cn(
                        "h-9 w-9 rounded-full border-2 transition",
                        color === c ? "border-foreground scale-110" : "border-transparent",
                      )}
                      style={{ background: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
        }
      />


      {/* Sheet tabs */}
      <SheetTabs
        sheets={sheets}
        activeId={activeSheetId}
        counts={exerciseCounts}
        accent={color}
        onSelect={setActiveSheetId}
        onAdd={handleAddSheet}
        onRename={(s) => setRenameDialog(s)}
        onDuplicate={handleDuplicateSheet}
        onDelete={handleDeleteSheet}
        onReorder={async (newSheets) => {
          setSheets(newSheets);
          await reorderSheets(newSheets);
        }}
      />

      {/* Sheet body (swipe between fichas) */}
      <div {...swipeHandlers} className="mt-2 space-y-2 pb-sticky-actions">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
        ) : !activeSheet ? (
          <EmptyNoSheet onAdd={handleAddSheet} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSheet.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="space-y-2"
            >
              {sheetItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Adicione exercícios à <span className="font-bold">Ficha {activeSheet.name}</span>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={sheetItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {sheetItems.map((it) => (
                      <SortableItem
                        key={it.id}
                        item={it}
                        accent={color}
                        onRemove={() => removeItem(it.id)}
                        onDuplicate={() => duplicateItem(it)}
                        onUpdate={(f, v) => updateField(it.id, f, v)}
                        onChangeImage={() =>
                          setImagePickerFor({
                            id: it.exercise_id,
                            name: it.exercises.name,
                            hasImage: !!(it.exercises.image_url || getUserOverride(it.exercise_id)),
                          })
                        }
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Sheet pager hint */}
        {sheets.length > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <button
              onClick={() => navSheet(-1)}
              disabled={!activeSheet || sheets.indexOf(activeSheet) === 0}
              className="flex items-center gap-1 disabled:opacity-30"
            >
              <ChevronLeft className="h-3 w-3" /> Anterior
            </button>
            <span>Deslize ← → para trocar de ficha</span>
            <button
              onClick={() => navSheet(1)}
              disabled={!activeSheet || sheets.indexOf(activeSheet) === sheets.length - 1}
              className="flex items-center gap-1 disabled:opacity-30"
            >
              Próxima <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-24 left-0 right-0 z-sticky mx-auto max-w-md px-5">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setPickerOpen(true)}
            disabled={!activeSheetId}
            variant="outline"
            className="h-12 rounded-2xl border-border bg-card font-semibold disabled:opacity-40"
          >
            <Plus className="mr-1 h-4 w-4" /> Exercício
          </Button>
          <Button
            onClick={() => navigate(`/execute/${id}`)}
            disabled={items.length === 0}
            className="h-12 rounded-2xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 shadow-glow disabled:opacity-40"
          >
            <Play className="mr-1 h-4 w-4 fill-current" /> Iniciar
          </Button>
        </div>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />

      {imagePickerFor && (
        <ExerciseImagePicker
          open={!!imagePickerFor}
          onOpenChange={(o) => !o && setImagePickerFor(null)}
          exerciseId={imagePickerFor.id}
          exerciseName={imagePickerFor.name}
          hasDefaultImage={imagePickerFor.hasImage}
          onChanged={(newUrl) => {
            setItems((cur) =>
              cur.map((it) =>
                it.exercise_id === imagePickerFor.id
                  ? { ...it, exercises: { ...it.exercises, image_url: newUrl ?? it.exercises.image_url } }
                  : it,
              ),
            );
          }}
        />
      )}

      {renameDialog && (
        <RenameSheetDialog
          sheet={renameDialog}
          onClose={() => setRenameDialog(null)}
          onSave={(n) => handleRenameSheet(renameDialog, n)}
        />
      )}

      <ConfirmDialog
        open={!!confirmingDeleteSheet}
        onOpenChange={(o) => !o && setConfirmingDeleteSheet(null)}
        title="Excluir ficha?"
        description={
          confirmingDeleteSheet
            ? `A ficha "${confirmingDeleteSheet.name}" e todos os seus exercícios serão removidos.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (confirmingDeleteSheet) await performDeleteSheet(confirmingDeleteSheet);
          setConfirmingDeleteSheet(null);
        }}
      />
    </div>
  );
}

/* ============== SHEET TABS ============== */
function SheetTabs({
  sheets, activeId, counts, accent, onSelect, onAdd, onRename, onDuplicate, onDelete, onReorder,
}: {
  sheets: RoutineSheet[];
  activeId: string | null;
  counts: Record<string, number>;
  accent: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (s: RoutineSheet) => void;
  onDuplicate: (s: RoutineSheet) => void;
  onDelete: (s: RoutineSheet) => void;
  onReorder: (next: RoutineSheet[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sheets.findIndex((s) => s.id === active.id);
    const newIdx = sheets.findIndex((s) => s.id === over.id);
    onReorder(arrayMove(sheets, oldIdx, newIdx));
  }

  return (
    <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
        <SortableContext items={sheets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sheets.map((s) => (
            <SheetTab
              key={s.id}
              sheet={s}
              active={s.id === activeId}
              count={counts[s.id] ?? 0}
              accent={accent}
              onSelect={() => onSelect(s.id)}
              onRename={() => onRename(s)}
              onDuplicate={() => onDuplicate(s)}
              onDelete={() => onDelete(s)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        onClick={onAdd}
        className="flex h-11 shrink-0 items-center gap-1 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-3 text-xs font-bold text-primary transition hover:bg-primary/15"
        aria-label="Nova ficha"
      >
        <Plus className="h-3.5 w-3.5" /> Ficha
      </button>
    </div>
  );
}

function SheetTab({
  sheet, active, count, accent, onSelect, onRename, onDuplicate, onDelete,
}: {
  sheet: RoutineSheet;
  active: boolean;
  count: number;
  accent: string;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sheet.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 0 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex h-11 shrink-0 items-center overflow-hidden rounded-2xl border transition",
        active ? "border-primary/60 bg-primary/15 shadow-glow" : "border-border bg-card",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none px-1.5 text-muted-foreground"
        aria-label="Reordenar ficha"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button onClick={onSelect} className="flex items-center gap-2 pl-1 pr-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg font-display text-sm font-extrabold",
            active ? "text-primary-foreground" : "text-foreground",
          )}
          style={{ background: active ? accent : `${accent}33` }}
        >
          {sheet.name.slice(0, 2)}
        </div>
        <div className="text-left">
          <div className="text-xs font-bold leading-tight">Ficha {sheet.name}</div>
          <div className="text-[10px] text-muted-foreground">{count} ex</div>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-full items-center px-2 text-muted-foreground hover:text-foreground" aria-label="Mais">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl border-border bg-card">
          <DropdownMenuItem onClick={onRename} className="rounded-xl">
            <Pencil className="mr-2 h-4 w-4" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate} className="rounded-xl">
            <CopyPlus className="mr-2 h-4 w-4" /> Duplicar ficha
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="rounded-xl text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RenameSheetDialog({ sheet, onClose, onSave }: { sheet: RoutineSheet; onClose: () => void; onSave: (n: string) => void }) {
  const [value, setValue] = useState(sheet.name);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">Renomear ficha</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 rounded-xl bg-secondary"
          autoFocus
          maxLength={20}
        />
        <Button
          onClick={() => onSave(value)}
          disabled={!value.trim()}
          className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          Salvar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function EmptyNoSheet({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">Crie sua primeira ficha (A, B, C…)</p>
      <Button onClick={onAdd} className="mt-4 rounded-xl bg-primary font-semibold text-primary-foreground">
        <Plus className="mr-1 h-4 w-4" /> Nova ficha
      </Button>
    </div>
  );
}

/* ============== EXERCISE ITEM ============== */
type EditableField = "target_sets" | "target_reps" | "target_weight" | "rest_seconds";

function SortableItem({
  item, accent, onRemove, onDuplicate, onUpdate, onChangeImage,
}: {
  item: WE;
  accent: string;
  onRemove: () => void;
  onDuplicate: () => void;
  onUpdate: (field: EditableField, value: number) => void;
  onChangeImage: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 0 };

  return (
    <div ref={setNodeRef} style={style} className={cn("card-premium relative overflow-hidden rounded-2xl p-4", isDragging && "shadow-elevated")}>
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: `linear-gradient(180deg, ${accent}, ${accent}55)` }} />
      <div className="flex items-center gap-2 pl-1">
        <button {...attributes} {...listeners} className="touch-none rounded-lg p-1 text-muted-foreground hover:bg-secondary">
          <GripVertical className="h-5 w-5" />
        </button>
        <button
          onClick={onChangeImage}
          className="relative shrink-0 group"
          aria-label="Trocar imagem"
          title="Trocar imagem"
        >
          <ExerciseImage
            exerciseId={item.exercise_id}
            name={item.exercises.name}
            muscleGroup={item.exercises.muscle_group}
            imageUrl={item.exercises.image_url}
            autoResolve={false}
            className="h-12 w-12"
            rounded="rounded-xl"
            fallbackSize="md"
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 opacity-0 transition group-hover:opacity-100 group-active:opacity-100">
            <ImagePlus className="h-4 w-4 text-foreground" />
          </div>
        </button>
        <div className="flex-1 truncate font-semibold">{item.exercises.name}</div>
        <button onClick={onDuplicate} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Duplicar">
          <Copy className="h-4 w-4" />
        </button>
        <button onClick={onRemove} className="rounded-lg p-1.5 text-destructive hover:bg-secondary" aria-label="Remover">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <NumField label="Séries" value={item.target_sets} onChange={(v) => onUpdate("target_sets", v)} />
        <NumField label="Reps" value={item.target_reps} onChange={(v) => onUpdate("target_reps", v)} />
        <NumField label="Carga" value={Number(item.target_weight ?? 0)} onChange={(v) => onUpdate("target_weight", v)} step={2.5} suffix="kg" />
        <NumField label="Pausa" value={item.rest_seconds} onChange={(v) => onUpdate("rest_seconds", v)} step={15} suffix="s" />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-secondary p-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-base font-bold outline-none"
      />
      {suffix && <div className="text-[9px] text-muted-foreground">{suffix}</div>}
    </div>
  );
}

function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ex: Exercise) => void }) {
  const [list, setList] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment")
      .order("name")
      .then(({ data }) => setList(data ?? []));
  }, [open]);

  const filtered = list.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl border-border bg-card">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Adicionar exercício</SheetTitle>
        </SheetHeader>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-xl bg-secondary pl-11"
          />
        </div>
        <div className="mt-3 -mx-6 max-h-[60vh] overflow-y-auto px-6 pb-8">
          {filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onPick(ex)}
              className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-secondary"
            >
              <div>
                <div className="font-semibold">{ex.name}</div>
                <div className="text-xs text-muted-foreground">
                  {ex.muscle_group} · {ex.equipment}
                </div>
              </div>
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
