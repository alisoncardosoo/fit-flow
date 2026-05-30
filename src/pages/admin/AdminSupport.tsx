import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Clock, CheckCircle2, MessageSquare, Mail, Smartphone, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AdminPageHeader,
  AdminCard,
  AdminKpiCard,
  StatusPill,
  AdminSkeleton,
  AdminErrorState,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import { fetchTickets, updateTicketStatus, type TicketRow } from "@/services/admin.service";
import {
  ticketStatusLabel,
  ticketStatusTone,
  ticketPriorityLabel,
  ticketPriorityTone,
  relativeDays,
} from "@/lib/adminData";

const channelIcon: Record<string, LucideIcon> = { email: Mail, chat: MessageSquare, app: Smartphone };
type Status = "open" | "pending" | "resolved";

export default function AdminSupport() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | "all">("all");
  const ticketsQ = useQuery({ queryKey: ["admin", "tickets"], queryFn: fetchTickets });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => updateTicketStatus(id, status),
    onSuccess: () => {
      toast.success("Ticket atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "tickets"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar"),
  });

  const tickets = ticketsQ.data ?? [];
  const filtered = tickets.filter((t) => filter === "all" || t.status === filter);
  const count = (s: Status) => tickets.filter((t) => t.status === s).length;

  return (
    <div>
      <AdminPageHeader title="Suporte" subtitle="Central de atendimento ao usuário" />

      <div className="grid grid-cols-3 gap-3">
        <AdminKpiCard label="Tickets abertos" value={String(count("open"))} icon={<LifeBuoy className="h-4 w-4" />} />
        <AdminKpiCard label="Em andamento" value={String(count("pending"))} icon={<Clock className="h-4 w-4" />} />
        <AdminKpiCard label="Resolvidos" value={String(count("resolved"))} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <AdminCard className="mt-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "open", "pending", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : f === "open" ? `Abertos (${count("open")})` : f === "pending" ? `Em andamento (${count("pending")})` : `Resolvidos (${count("resolved")})`}
            </button>
          ))}
        </div>

        {ticketsQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <AdminSkeleton key={i} className="h-16" />)}</div>
        ) : ticketsQ.isError ? (
          <AdminErrorState message={(ticketsQ.error as Error)?.message} onRetry={() => ticketsQ.refetch()} />
        ) : filtered.length === 0 ? (
          <AdminEmptyState
            icon={<LifeBuoy className="h-5 w-5" />}
            title="Nenhum ticket nesta categoria"
            description="Os tickets abertos pelos usuários no app aparecerão aqui."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((t: TicketRow) => {
              const Icon = channelIcon[t.channel] ?? MessageSquare;
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{relativeDays(t.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill tone={ticketPriorityTone[t.priority] ?? "muted"}>{ticketPriorityLabel[t.priority]}</StatusPill>
                    <StatusPill tone={ticketStatusTone[t.status] ?? "muted"}>{ticketStatusLabel[t.status]}</StatusPill>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="rounded-lg border-border">Mudar status</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: t.id, status: "open" })}>Aberto</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: t.id, status: "pending" })}>Em andamento</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: t.id, status: "resolved" })}>Resolvido</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
