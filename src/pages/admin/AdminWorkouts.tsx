import { useMemo, useState } from "react";
import {
  Plus,
  Star,
  Users as UsersIcon,
  CheckCircle2,
  Copy,
  Archive,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/AdminUI";
import {
  workouts,
  categoryLabel,
  fmtNumber,
  relativeDays,
  type WorkoutCategory,
} from "@/lib/adminData";

const categories: (WorkoutCategory | "all")[] = [
  "all",
  "hypertrophy",
  "weight_loss",
  "cardio",
  "mobility",
  "stretching",
  "home",
];

export default function AdminWorkouts() {
  const [cat, setCat] = useState<WorkoutCategory | "all">("all");

  const filtered = useMemo(
    () => workouts.filter((w) => cat === "all" || w.category === cat),
    [cat],
  );

  return (
    <div>
      <AdminPageHeader
        title="Treinos"
        subtitle="Gestão da biblioteca de treinos"
        actions={
          <Button
            className="h-10 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("Novo treino")}
          >
            <Plus className="h-4 w-4" /> Criar treino
          </Button>
        }
      />

      {/* Category filter */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              cat === c
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {c === "all" ? "Todos" : categoryLabel[c]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((w) => (
          <AdminCard key={w.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{w.name}</h3>
                  {w.archived && <StatusPill tone="muted">Arquivado</StatusPill>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {w.author} • atualizado {relativeDays(w.updatedAt)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => toast.info("Editando treino")}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("Treino duplicado")}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toast.warning("Treino arquivado")}>
                    <Archive className="mr-2 h-4 w-4" /> Arquivar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3">
              <StatusPill tone="primary">{categoryLabel[w.category]}</StatusPill>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-sm font-semibold">
                  <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {fmtNumber(w.athletes)}
                </div>
                <p className="text-[10px] text-muted-foreground">Alunos</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-sm font-semibold">
                  <Star className="h-3.5 w-3.5 text-primary" />
                  {w.rating.toFixed(1)}
                </div>
                <p className="text-[10px] text-muted-foreground">Avaliação</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-sm font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  {fmtNumber(w.completions)}
                </div>
                <p className="text-[10px] text-muted-foreground">Conclusões</p>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}
