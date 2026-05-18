import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, GripVertical, Trash2, Plus, Play, Search } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Exercise = { id: string; name: string; muscle_group: string; equipment: string };
type WE = {
  id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight: number | null;
  rest_seconds: number;
  exercises: Exercise;
};

export default function BuilderEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [items, setItems] = useState<WE[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [defaults, setDefaults] = useState({ sets: 3, reps: 10, rest: 60 });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { if (id) void load(); }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: w }, { data: we }, { data: prof }] = await Promise.all([
      supabase.from("workouts").select("name").eq("id", id).maybeSingle(),
      supabase.from("workout_exercises").select("*, exercises(id, name, muscle_group, equipment)").eq("workout_id", id).order("position", { ascending: true }),
      user
        ? supabase.from("profiles").select("default_sets, default_reps, default_rest_seconds").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (w) setName(w.name);
    setItems((we as WE[]) ?? []);
    if (prof) {
      setDefaults({
        sets: prof.default_sets ?? 3,
        reps: prof.default_reps ?? 10,
        rest: prof.default_rest_seconds ?? 60,
      });
    }
    setLoading(false);
  }

  async function saveName() {
    if (!id) return;
    await supabase.from("workouts").update({ name }).eq("id", id);
  }

  async function addExercise(ex: Exercise) {
    if (!id) return;
    const { data, error } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: id,
        exercise_id: ex.id,
        position: items.length,
        target_sets: defaults.sets,
        target_reps: defaults.reps,
        target_weight: 0,
        rest_seconds: defaults.rest,
      })
      .select("*, exercises(id, name, muscle_group, equipment)")
      .single();
    if (error || !data) { toast.error("Erro"); return; }
    setItems((cur) => [...cur, data as WE]);
    setPickerOpen(false);
  }

  async function removeItem(weId: string) {
    await supabase.from("workout_exercises").delete().eq("id", weId);
    setItems((cur) => cur.filter((i) => i.id !== weId));
  }

  type EditableField = "target_sets" | "target_reps" | "target_weight" | "rest_seconds";

  async function updateField(weId: string, field: EditableField, value: number) {
    setItems((cur) => cur.map((i) => i.id === weId ? { ...i, [field]: value } : i));
    if (field === "target_sets") await supabase.from("workout_exercises").update({ target_sets: value }).eq("id", weId);
    else if (field === "target_reps") await supabase.from("workout_exercises").update({ target_reps: value }).eq("id", weId);
    else if (field === "target_weight") await supabase.from("workout_exercises").update({ target_weight: value }).eq("id", weId);
    else if (field === "rest_seconds") await supabase.from("workout_exercises").update({ rest_seconds: value }).eq("id", weId);
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    await Promise.all(reordered.map((it, idx) => supabase.from("workout_exercises").update({ position: idx }).eq("id", it.id)));
  }

  return (
    <div className="px-5 safe-top">
      <div className="mb-3 flex items-center gap-2">
        <Link to="/builder" className="rounded-xl p-2 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} className="h-12 flex-1 rounded-2xl border-border bg-secondary text-lg font-display font-bold" />
      </div>

      <div className="space-y-2 pb-sticky-actions">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Adicione exercícios para começar
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((it) => (
                <SortableItem key={it.id} item={it} onRemove={() => removeItem(it.id)} onUpdate={(f, v) => updateField(it.id, f, v)} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-24 left-0 right-0 z-sticky mx-auto max-w-md px-5">
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => setPickerOpen(true)} variant="outline" className="h-12 rounded-2xl border-border bg-card font-semibold">
            <Plus className="mr-1 h-4 w-4" /> Exercício
          </Button>
          <Button
            onClick={() => navigate(`/execute/${id}`)}
            disabled={items.length === 0}
            className="h-12 rounded-2xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 glow-primary disabled:opacity-40"
          >
            <Play className="mr-1 h-4 w-4 fill-current" /> Iniciar
          </Button>
        </div>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />
    </div>
  );
}

type EditableField = "target_sets" | "target_reps" | "target_weight" | "rest_seconds";

function SortableItem({ item, onRemove, onUpdate }: { item: WE; onRemove: () => void; onUpdate: (field: EditableField, value: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 0 };

  return (
    <div ref={setNodeRef} style={style} className={`card-premium rounded-2xl p-4 ${isDragging ? "shadow-elevated" : ""}`}>
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="touch-none rounded-lg p-1 text-muted-foreground hover:bg-secondary">
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 truncate font-semibold">{item.exercises.name}</div>
        <button onClick={onRemove} className="rounded-lg p-1 text-destructive hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
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
    void supabase.from("exercises").select("id, name, muscle_group, equipment").order("name").then(({ data }) => setList(data ?? []));
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
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-xl bg-secondary pl-11" />
        </div>
        <div className="mt-3 -mx-6 max-h-[60vh] overflow-y-auto px-6 pb-8">
          {filtered.map((ex) => (
            <button key={ex.id} onClick={() => onPick(ex)} className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-secondary">
              <div>
                <div className="font-semibold">{ex.name}</div>
                <div className="text-xs text-muted-foreground">{ex.muscle_group} · {ex.equipment}</div>
              </div>
              <Plus className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
