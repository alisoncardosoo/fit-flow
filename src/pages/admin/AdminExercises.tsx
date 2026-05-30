import { useMemo, useState } from "react";
import { Plus, Search, Film, Image as ImageIcon, Dumbbell } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/AdminUI";
import {
  exercises,
  muscleLabel,
  difficultyLabel,
  fmtNumber,
  type MuscleGroup,
  type Difficulty,
  type AdminExercise,
} from "@/lib/adminData";

const diffTone: Record<Difficulty, "success" | "warning" | "destructive"> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "destructive",
};

export default function AdminExercises() {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [selected, setSelected] = useState<AdminExercise>(exercises[0]);

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        const q = query.trim().toLowerCase();
        return (
          (!q || e.name.toLowerCase().includes(q)) &&
          (muscle === "all" || e.muscle === muscle) &&
          (difficulty === "all" || e.difficulty === difficulty)
        );
      }),
    [query, muscle, difficulty],
  );

  return (
    <div>
      <AdminPageHeader
        title="Exercícios"
        subtitle={`Banco com ${exercises.length} exercícios`}
        actions={
          <Button
            className="h-10 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("Novo exercício")}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* List */}
        <AdminCard className="lg:col-span-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar exercício"
                className="h-10 rounded-xl border-border bg-secondary pl-10"
              />
            </div>
            <Select value={muscle} onValueChange={(v) => setMuscle(v as MuscleGroup | "all")}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-secondary text-sm sm:w-40">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos grupos</SelectItem>
                {(Object.keys(muscleLabel) as MuscleGroup[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {muscleLabel[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty | "all")}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-secondary text-sm sm:w-36">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos níveis</SelectItem>
                {(Object.keys(difficultyLabel) as Difficulty[]).map((d) => (
                  <SelectItem key={d} value={d}>
                    {difficultyLabel[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="no-scrollbar max-h-[560px] space-y-2 overflow-y-auto">
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  selected.id === e.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 bg-secondary/40 hover:bg-secondary"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Dumbbell className="h-5 w-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {muscleLabel[e.muscle]} • {e.equipment}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {e.hasVideo && <Film className="h-3.5 w-3.5 text-primary" />}
                  {e.hasGif && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  <StatusPill tone={diffTone[e.difficulty]}>
                    {difficultyLabel[e.difficulty]}
                  </StatusPill>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum exercício encontrado.
              </p>
            )}
          </div>
        </AdminCard>

        {/* Preview */}
        <AdminCard title="Preview" subtitle="Visualização instantânea">
          <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary">
            {selected.hasVideo ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Film className="h-10 w-10" />
                <span className="text-xs">Vídeo demonstrativo</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <span className="text-xs">GIF do movimento</span>
              </div>
            )}
          </div>

          <h3 className="mt-4 text-lg font-semibold">{selected.name}</h3>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Grupo muscular</dt>
              <dd className="font-medium">{muscleLabel[selected.muscle]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Equipamento</dt>
              <dd className="font-medium">{selected.equipment}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nível</dt>
              <dd>
                <StatusPill tone={diffTone[selected.difficulty]}>
                  {difficultyLabel[selected.difficulty]}
                </StatusPill>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Usos</dt>
              <dd className="font-medium">{fmtNumber(selected.uses)}</dd>
            </div>
          </dl>

          <Button
            variant="outline"
            className="mt-4 w-full rounded-xl border-border"
            onClick={() => toast.info("Editando exercício")}
          >
            Editar exercício
          </Button>
        </AdminCard>
      </div>
    </div>
  );
}
