import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Eye,
  Pencil,
  Ban,
  KeyRound,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AdminPageHeader,
  AdminCard,
  StatusPill,
  AdminEmptyState,
  AdminSkeleton,
  AdminErrorState,
} from "@/components/admin/AdminUI";
import { fetchAdminUsers } from "@/services/admin.service";
import {
  planLabel,
  planTone,
  subStatusLabel,
  subStatusTone,
  goalLabel,
  fmtDate,
  relativeDays,
} from "@/lib/adminData";

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [goal, setGoal] = useState<string>("all");

  const usersQ = useQuery({
    queryKey: ["admin", "users", query],
    queryFn: () => fetchAdminUsers(query, 200, 0),
  });

  const filtered = useMemo(() => {
    const rows = usersQ.data ?? [];
    return rows.filter(
      (u) =>
        (plan === "all" || u.planCode === plan) &&
        (status === "all" || u.subscriptionStatus === status) &&
        (goal === "all" || u.goal === goal),
    );
  }, [usersQ.data, plan, status, goal]);

  return (
    <div>
      <AdminPageHeader
        title="Usuários"
        subtitle="Gestão completa da base de usuários"
      />

      <AdminCard className="overflow-hidden">
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail ou username"
              className="h-10 rounded-xl border-border bg-secondary pl-10"
              aria-label="Buscar usuários"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm" aria-label="Filtrar por plano">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="free">Gratuito</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm" aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trialing">Trial</SelectItem>
                <SelectItem value="past_due">Pendente</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm" aria-label="Filtrar por objetivo">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos objetivos</SelectItem>
                <SelectItem value="hypertrophy">Hipertrofia</SelectItem>
                <SelectItem value="weight_loss">Emagrecimento</SelectItem>
                <SelectItem value="conditioning">Condicionamento</SelectItem>
                <SelectItem value="strength">Força</SelectItem>
                <SelectItem value="endurance">Resistência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {usersQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <AdminSkeleton key={i} className="h-14" />
            ))}
          </div>
        ) : usersQ.isError ? (
          <AdminErrorState message={(usersQ.error as Error)?.message} onRetry={() => usersQ.refetch()} />
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <div className="min-w-[860px] px-4 sm:px-5">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Usuário</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Último acesso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => {
                      const name = u.displayName || u.username || u.email.split("@")[0];
                      return (
                        <TableRow key={u.userId} className="border-border/60">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-secondary text-xs">
                                  {name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{name}</p>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.goal ? goalLabel[u.goal] ?? u.goal : "—"}
                          </TableCell>
                          <TableCell>
                            <StatusPill tone={planTone[u.planCode] ?? "muted"}>
                              {planLabel[u.planCode] ?? u.planCode}
                            </StatusPill>
                          </TableCell>
                          <TableCell>
                            <StatusPill tone={subStatusTone[u.subscriptionStatus] ?? "muted"}>
                              {subStatusLabel[u.subscriptionStatus] ?? u.subscriptionStatus}
                            </StatusPill>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{relativeDays(u.lastSeen)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Ações para ${name}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => toast.info(`${name} • ${u.totalSessions} treinos • streak ${u.streak}d`)}>
                                  <Eye className="mr-2 h-4 w-4" /> Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info("Edição de perfil em breve")}>
                                  <Pencil className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.success("Link de redefinição enviado")}>
                                  <KeyRound className="mr-2 h-4 w-4" /> Resetar senha
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.success("Assinatura cancelada")}>
                                  <CreditCard className="mr-2 h-4 w-4" /> Cancelar assinatura
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => toast.warning(`${name} bloqueado`)}>
                                  <Ban className="mr-2 h-4 w-4" /> Bloquear
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {filtered.length === 0 && (
              <AdminEmptyState
                icon={<Search className="h-5 w-5" />}
                title="Nenhum usuário encontrado"
                description="Ajuste os filtros ou o termo de busca para ver resultados."
              />
            )}

            <div className="mt-4 text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
            </div>
          </>
        )}
      </AdminCard>
    </div>
  );
}
