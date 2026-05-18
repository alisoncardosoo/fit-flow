import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Plus, Sparkles, Loader2, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseImagePicker } from "@/components/ExerciseImagePicker";
import { FilterPill, FilterPillsRow } from "@/components/FilterPill";
import { getUserOverride } from "@/lib/exerciseImageCache";
import type { Database } from "@/integrations/supabase/types";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
type Muscle = Database["public"]["Enums"]["muscle_group"];
type Equipment = Database["public"]["Enums"]["equipment_type"];
type Difficulty = Database["public"]["Enums"]["difficulty_level"];

const muscleLabels: Record<Muscle, string> = {
  chest: "Peito", back: "Costas", shoulders: "Ombros", biceps: "Bíceps", triceps: "Tríceps",
  forearms: "Antebraço", quads: "Quadríceps", hamstrings: "Posterior", glutes: "Glúteo",
  calves: "Panturrilha", core: "Core", cardio: "Cardio", full_body: "Full body",
};

const equipmentLabels: Record<Equipment, string> = {
  barbell: "Barra", dumbbell: "Halteres", machine: "Máquina", cable: "Polia",
  bodyweight: "Peso corporal", kettlebell: "Kettlebell", band: "Elástico", other: "Outro",
};

export default function Library() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<Muscle | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);

  // Add custom exercise
  const [createOpen, setCreateOpen] = useState(false);

  // Image picker (upload/IA/restaurar)
  const [pickerOpen, setPickerOpen] = useState(false);

  // AI suggest
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .order("name", { ascending: true });
    setExercises(data ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (muscleFilter && ex.muscle_group !== muscleFilter) return false;
      if (equipmentFilter && ex.equipment !== equipmentFilter) return false;
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [exercises, muscleFilter, equipmentFilter, search]);

  async function suggestWithAI(muscle: Muscle) {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-exercises", {
        body: { muscle_group: muscle, available_names: exercises.map(e => e.name) },
      });
      if (error) throw error;
      setAiSuggestions(data?.suggestions ?? []);
    } catch {
      toast.error("Não foi possível obter sugestões");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow={`${exercises.length} exercícios`}
        title="Biblioteca"
        subtitle="Encontre, filtre e crie seus exercícios"
        actions={
          <>
            <button
              onClick={() => setAiOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary transition hover:bg-primary/25"
              title="Sugestões IA"
            >
              <Sparkles className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition hover:scale-105"
              title="Novo exercício"
            >
              <Plus className="h-[18px] w-[18px]" />
            </button>
          </>
        }
      />

      {/* Hero search card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-hero mb-5 rounded-[24px] p-5"
      >
        <div className="relative z-10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60" />
            <Input
              placeholder="Buscar exercício…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 rounded-full border-foreground/15 bg-background/40 pl-11 text-base backdrop-blur-md placeholder:text-foreground/50"
            />
          </div>
        </div>
      </motion.div>

      {/* Muscle pills */}
      <FilterPillsRow className="mb-3">
        <FilterPill active={muscleFilter === null} onClick={() => setMuscleFilter(null)}>
          Todos
        </FilterPill>
        {(Object.keys(muscleLabels) as Muscle[]).map((m) => (
          <FilterPill
            key={m}
            active={muscleFilter === m}
            onClick={() => setMuscleFilter((cur) => (cur === m ? null : m))}
          >
            {muscleLabels[m]}
          </FilterPill>
        ))}
      </FilterPillsRow>

      {/* Equipment pills */}
      <FilterPillsRow className="mb-5">
        <FilterPill
          active={equipmentFilter === null}
          onClick={() => setEquipmentFilter(null)}
          size="sm"
          icon={<Filter className="h-3 w-3" />}
        >
          Equipamento
        </FilterPill>
        {(Object.keys(equipmentLabels) as Equipment[]).map((e) => (
          <FilterPill
            key={e}
            active={equipmentFilter === e}
            onClick={() => setEquipmentFilter((cur) => (cur === e ? null : e))}
            size="sm"
          >
            {equipmentLabels[e]}
          </FilterPill>
        ))}
      </FilterPillsRow>

      {/* List */}
      <div className="space-y-2 pb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum exercício encontrado.
          </div>
        ) : (
          filtered.map((ex, i) => (
            <motion.button
              key={ex.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              onClick={() => setSelected(ex)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
            >
              <ExerciseImage
                exerciseId={ex.id}
                name={ex.name}
                muscleGroup={ex.muscle_group}
                imageUrl={ex.image_url}
                autoResolve={false}
                className="h-14 w-14 shrink-0"
                rounded="rounded-xl"
                fallbackSize="md"
              />
              
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{ex.name}</div>
                <div className="text-xs text-muted-foreground">
                  {muscleLabels[ex.muscle_group]} · {equipmentLabels[ex.equipment]}
                </div>
              </div>
              <DifficultyBadge level={ex.difficulty} />
            </motion.button>
          ))
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="font-display text-2xl">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="relative mt-4">
                <ExerciseImage
                  exerciseId={selected.id}
                  name={selected.name}
                  muscleGroup={selected.muscle_group}
                  imageUrl={selected.image_url}
                  onResolved={(url) => {
                    setSelected({ ...selected, image_url: url });
                    setExercises((cur) => cur.map((e) => (e.id === selected.id ? { ...e, image_url: url } : e)));
                  }}
                  className="aspect-video w-full"
                  rounded="rounded-2xl"
                  fallbackSize="lg"
                />
                <button
                  onClick={() => setPickerOpen(true)}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-2 text-xs font-semibold backdrop-blur-md shadow-lg transition hover:bg-background"
                  title="Trocar imagem"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Trocar imagem
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{muscleLabels[selected.muscle_group]}</Badge>
                <Badge>{equipmentLabels[selected.equipment]}</Badge>
                <DifficultyBadge level={selected.difficulty} />
              </div>
              {selected.description && (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
              )}
              {selected.tips && (
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-primary">Dica</div>
                  <p className="mt-1 text-sm">{selected.tips}</p>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Image picker (upload / IA / restaurar) */}
      {selected && (
        <ExerciseImagePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          exerciseId={selected.id}
          exerciseName={selected.name}
          hasDefaultImage={!!(selected.image_url || getUserOverride(selected.id))}
          onChanged={(newUrl) => {
            // Atualiza UI local imediatamente
            setSelected((cur) =>
              cur ? { ...cur, image_url: newUrl ?? cur.image_url } : cur,
            );
          }}
        />
      )}

      {/* Create custom exercise */}
      <CreateExerciseDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load(); }} />

      {/* AI dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md rounded-3xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-4 w-4 text-primary" /> Sugestões com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Escolha um grupo muscular e a IA sugere exercícios:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(muscleLabels) as Muscle[]).map((m) => (
                <button
                  key={m}
                  onClick={() => suggestWithAI(m)}
                  disabled={aiLoading}
                  className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold transition hover:bg-secondary/80 disabled:opacity-50"
                >
                  {muscleLabels[m]}
                </button>
              ))}
            </div>
            {aiLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {aiSuggestions.length > 0 && (
              <div className="mt-2 space-y-2">
                {aiSuggestions.map((s, i) => (
                  <div key={i} className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateExerciseDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<Muscle>("chest");
  const [equipment, setEquipment] = useState<Equipment>("dumbbell");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("exercises").insert({
      name: name.trim(),
      muscle_group: muscle,
      equipment,
      difficulty,
      is_public: false,
      user_id: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Exercício criado!");
    setName("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">Novo exercício</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Nome do exercício" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-secondary" />
          <SelectField label="Grupo muscular" value={muscle} onChange={(v) => setMuscle(v as Muscle)} options={Object.entries(muscleLabels)} />
          <SelectField label="Equipamento" value={equipment} onChange={(v) => setEquipment(v as Equipment)} options={Object.entries(equipmentLabels)} />
          <SelectField label="Dificuldade" value={difficulty} onChange={(v) => setDifficulty(v as Difficulty)} options={[["beginner", "Iniciante"], ["intermediate", "Intermediário"], ["advanced", "Avançado"]]} />
          <Button onClick={save} disabled={saving || !name.trim()} className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            {saving ? "Salvando…" : "Criar exercício"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm"
      >
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}

// FilterPill local removido — substituído por @/components/FilterPill (compartilhado).

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{children}</span>;
}

function DifficultyBadge({ level }: { level: Difficulty }) {
  const map = {
    beginner: { label: "Fácil", color: "bg-success/10 text-success" },
    intermediate: { label: "Médio", color: "bg-warning/10 text-warning" },
    advanced: { label: "Difícil", color: "bg-destructive/10 text-destructive" },
  };
  const c = map[level];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.color}`}>{c.label}</span>;
}

function muscleEmoji(m: Muscle) {
  const e: Record<Muscle, string> = {
    chest: "💪", back: "🔙", shoulders: "🏔️", biceps: "💪", triceps: "🦾",
    forearms: "✊", quads: "🦵", hamstrings: "🦵", glutes: "🍑", calves: "🦶",
    core: "🎯", cardio: "❤️", full_body: "🏋️",
  };
  return e[m];
}
