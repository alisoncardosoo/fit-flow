import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Image as ImageIcon, Dumbbell } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AdminPageHeader,
  AdminCard,
  StatusPill,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import { fetchAdminExercises, type AdminExerciseRow } from "@/services/admin.service";
import { muscleLabel, difficultyLabel, difficultyTone, equipmentLabel } from "@/lib/adminData";

export default function AdminExercises() {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const exercisesQ = useQuery({ queryKey: ["admin", "exercises"], queryFn: fetchAdminExercises });

  const filtered = useMemo(() => {
    const rows = exercisesQ.data ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter(
      (e) =>
        (!q || e.name.toLowerCase().includes(q)) &&
        (muscle === "all" || e.muscleGroup === muscle) &&
        (difficulty === "all" || e.difficulty === difficulty),
    );
  }, [exercisesQ.data, query, muscle, difficulty]);

  const selected: AdminExerciseRow | undefined =
    filtered.find((e) => e.id === selectedId) ?? filtered[0];

  return (
    <div>
      <AdminPageHeader
        title="Exercícios"
        subtitle={`Banco com ${exercisesQ.data?.length ?? 0} exercícios públicos`}
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
                aria-label="Buscar exercício"
              />
            </div>
            <Select value={muscle} onValueChange={setMuscle}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-secondary text-sm sm:w-40" aria-label="Filtrar por grupo muscular">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos grupos</SelectItem>
                {Object.entries(muscleLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border bg-secondary text-sm sm:w-36" aria-label="Filtrar por nível">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos níveis</SelectItem>
                {Object.entries(difficultyLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {exercisesQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <AdminSkeleton key={i} className="h-16" />)}
            </div>
          ) : exercisesQ.isError ? (
            <AdminErrorState message={(exercisesQ.error as Error)?.message} onRetry={() => exercisesQ.refetch()} />
          ) : filtered.length === 0 ? (
            <AdminEmptyState icon={<Dumbbell className="h-5 w-5" />} title="Nenhum exercício encontrado" />
          ) : (
            <div className="no-scrollbar max-h-[560px] space-y-2 overflow-y-auto">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected?.id === e.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/60 bg-secondary/40 hover:bg-secondary"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                    {e.imageUrl ? (
                      <img src={e.imageUrl} alt={e.name} className="h-full w-full object-cover" />
                    ) : (
                      <Dumbbell className="h-5 w-5 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {muscleLabel[e.muscleGroup] ?? e.muscleGroup} • {equipmentLabel[e.equipment] ?? e.equipment}
                    </p>
                  </div>
                  <StatusPill tone={difficultyTone[e.difficulty] ?? "muted"}>
                    {difficultyLabel[e.difficulty] ?? e.difficulty}
                  </StatusPill>
                </button>
              ))}
            </div>
          )}
        </AdminCard>

        {/* Preview */}
        <AdminCard title="Preview" subtitle="Visualização instantânea">
          {!selected ? (
            <AdminEmptyState icon={<ImageIcon className="h-5 w-5" />} title="Selecione um exercício" />
          ) : (
            <>
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-secondary">
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt={selected.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-10 w-10" />
                    <span className="text-xs">Sem imagem</span>
                  </div>
                )}
              </div>

              <h3 className="mt-4 text-lg font-semibold">{selected.name}</h3>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Grupo muscular</dt>
                  <dd className="font-medium">{muscleLabel[selected.muscleGroup] ?? selected.muscleGroup}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Equipamento</dt>
                  <dd className="font-medium">{equipmentLabel[selected.equipment] ?? selected.equipment}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nível</dt>
                  <dd>
                    <StatusPill tone={difficultyTone[selected.difficulty] ?? "muted"}>
                      {difficultyLabel[selected.difficulty] ?? selected.difficulty}
                    </StatusPill>
                  </dd>
                </div>
              </dl>
            </>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
