import { useMemo, useState } from "react";
import {
  Search,
  Eye,
  Pencil,
  Ban,
  KeyRound,
  CreditCard,
  MoreHorizontal,
  Download,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, StatusPill, AdminEmptyState } from "@/components/admin/AdminUI";
import {
  users,
  planLabel,
  statusLabel,
  goalLabel,
  fmtDate,
  relativeDays,
  type Plan,
  type UserStatus,
  type Goal,
} from "@/lib/adminData";

const statusTone: Record<UserStatus, "success" | "muted" | "destructive" | "warning"> = {
  active: "success",
  inactive: "muted",
  blocked: "destructive",
  trial: "warning",
};

const planTone: Record<Plan, "primary" | "muted" | "success"> = {
  free: "muted",
  premium: "primary",
  annual: "success",
};

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<Plan | "all">("all");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [goal, setGoal] = useState<Goal | "all">("all");

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        return (
          matchesQuery &&
          (plan === "all" || u.plan === plan) &&
          (status === "all" || u.status === status) &&
          (goal === "all" || u.goal === goal)
        );
      }),
    [query, plan, status, goal],
  );

  return (
    <div>
      <AdminPageHeader
        title="Usuários"
        subtitle={`${users.length} cadastrados • gestão completa da base`}
        actions={
          <Button variant="outline" className="h-10 gap-1.5 rounded-xl border-border">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <AdminCard className="overflow-hidden">
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="h-10 rounded-xl border-border bg-secondary pl-10"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={plan} onValueChange={(v) => setPlan(v as Plan | "all")}>
              <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="free">Gratuito</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as UserStatus | "all")}>
              <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={goal} onValueChange={(v) => setGoal(v as Goal | "all")}>
              <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos objetivos</SelectItem>
                <SelectItem value="hypertrophy">Hipertrofia</SelectItem>
                <SelectItem value="weight_loss">Emagrecimento</SelectItem>
                <SelectItem value="conditioning">Condicionamento</SelectItem>
                <SelectItem value="health">Saúde</SelectItem>
                <SelectItem value="strength">Força</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
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
                {filtered.slice(0, 25).map((u) => (
                  <TableRow key={u.id} className="border-border/60">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatar} alt={u.name} />
                          <AvatarFallback className="bg-secondary text-xs">
                            {u.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {goalLabel[u.goal]}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={planTone[u.plan]}>{planLabel[u.plan]}</StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={statusTone[u.status]}>{statusLabel[u.status]}</StatusPill>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeDays(u.lastSeenAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => toast.info(`Perfil de ${u.name}`)}>
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(`Editando ${u.name}`)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Link de redefinição enviado")}>
                            <KeyRound className="mr-2 h-4 w-4" /> Resetar senha
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success("Assinatura cancelada")}>
                            <CreditCard className="mr-2 h-4 w-4" /> Cancelar assinatura
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => toast.warning(`${u.name} bloqueado`)}
                          >
                            <Ban className="mr-2 h-4 w-4" /> Bloquear
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Mostrando {Math.min(filtered.length, 25)} de {filtered.length} resultados
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-lg border-border" disabled>
              Anterior
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg border-border">
              Próximo
            </Button>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
