import { useQuery } from "@tanstack/react-query";
import {
  Users as UsersIcon,
  CheckCircle2,
  Copy,
  Archive,
  MoreHorizontal,
  Pencil,
  Dumbbell,
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
import {
  AdminPageHeader,
  AdminCard,
  StatusPill,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import { fetchWorkoutMetrics } from "@/services/admin.service";
import { fmtNumber, relativeDays } from "@/lib/adminData";

export default function AdminWorkouts() {
  const workoutsQ = useQuery({ queryKey: ["admin", "workout-metrics"], queryFn: fetchWorkoutMetrics });
  const workouts = workoutsQ.data ?? [];

  return (
    <div>
      <AdminPageHeader title="Treinos" subtitle="Gestão da biblioteca de treinos" />

      {workoutsQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AdminSkeleton key={i} className="h-44" />
          ))}
        </div>
      ) : workoutsQ.isError ? (
        <AdminCard>
          <AdminErrorState message={(workoutsQ.error as Error)?.message} onRetry={() => workoutsQ.refetch()} />
        </AdminCard>
      ) : workouts.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={<Dumbbell className="h-5 w-5" />}
            title="Nenhum treino cadastrado ainda"
            description="Quando os usuários criarem treinos, eles aparecerão aqui com métricas de uso."
          />
        </AdminCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workouts.map((w) => (
            <AdminCard key={w.workoutId} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{w.name}</h3>
                    {w.archived && <StatusPill tone="muted">Arquivado</StatusPill>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    atualizado {relativeDays(w.updatedAt)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Ações para ${w.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => toast.info("Edição em breve")}>
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

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-sm font-semibold">
                    <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {fmtNumber(w.athletes)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Alunos usando</p>
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
      )}
    </div>
  );
}
