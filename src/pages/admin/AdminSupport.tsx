import { useState } from "react";
import { LifeBuoy, Clock, CheckCircle2, MessageSquare, Mail, Smartphone, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, AdminKpiCard, StatusPill } from "@/components/admin/AdminUI";
import {
  tickets,
  relativeDays,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/adminData";

const statusLabel: Record<TicketStatus, string> = {
  open: "Aberto",
  pending: "Em andamento",
  resolved: "Resolvido",
};
const statusTone: Record<TicketStatus, "warning" | "primary" | "success"> = {
  open: "warning",
  pending: "primary",
  resolved: "success",
};
const prioTone: Record<TicketPriority, "destructive" | "warning" | "muted" | "primary"> = {
  critical: "destructive",
  high: "destructive",
  medium: "warning",
  low: "muted",
};
const prioLabel: Record<TicketPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const channelIcon: Record<string, LucideIcon> = {
  email: Mail,
  chat: MessageSquare,
  app: Smartphone,
};

export default function AdminSupport() {
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const filtered = tickets.filter((t) => filter === "all" || t.status === filter);

  const open = tickets.filter((t) => t.status === "open").length;
  const pending = tickets.filter((t) => t.status === "pending").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div>
      <AdminPageHeader title="Suporte" subtitle="Central de atendimento ao usuário" />

      <div className="grid grid-cols-3 gap-3">
        <AdminKpiCard label="Tickets abertos" value={String(open)} delta={-2.0} icon={<LifeBuoy className="h-4 w-4" />} invertDelta />
        <AdminKpiCard label="Tempo médio de resposta" value="2.4h" delta={-8.0} icon={<Clock className="h-4 w-4" />} invertDelta />
        <AdminKpiCard label="Satisfação (CSAT)" value="94%" delta={1.5} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <AdminCard className="mt-4">
        <div className="mb-4 flex gap-2">
          {(["all", "open", "pending", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all"
                ? "Todos"
                : f === "open"
                ? `Abertos (${open})`
                : f === "pending"
                ? `Em andamento (${pending})`
                : `Resolvidos (${resolved})`}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((t) => {
            const Icon = channelIcon[t.channel] ?? MessageSquare;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.user} • {relativeDays(t.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={prioTone[t.priority]}>{prioLabel[t.priority]}</StatusPill>
                  <StatusPill tone={statusTone[t.status]}>{statusLabel[t.status]}</StatusPill>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hidden rounded-lg border-border sm:inline-flex"
                    onClick={() => toast.info(`Abrindo ticket de ${t.user}`)}
                  >
                    Responder
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum ticket nesta categoria. 🎉
            </p>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
