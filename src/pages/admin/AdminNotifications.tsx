import { useState } from "react";
import { Send, Bell, Users as UsersIcon, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/AdminUI";
import { fmtNumber } from "@/lib/adminData";

const sent = [
  { id: 1, title: "Bora treinar hoje? 💪", audience: "Inativos 3 dias", reach: 184, opened: 96, date: "Hoje, 08:00" },
  { id: 2, title: "Sua evolução semanal chegou", audience: "Todos ativos", reach: 3980, opened: 2210, date: "Ontem, 19:00" },
  { id: 3, title: "Oferta: 30% no plano anual", audience: "Gratuitos", reach: 1760, opened: 540, date: "2 dias atrás" },
  { id: 4, title: "Novo desafio comunitário 🏆", audience: "Premium", reach: 920, opened: 612, date: "3 dias atrás" },
];

export default function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");

  const send = () => {
    if (!title.trim()) return toast.error("Adicione um título");
    toast.success("Notificação enviada para a fila 🚀");
    setTitle("");
    setBody("");
  };

  return (
    <div>
      <AdminPageHeader
        title="Notificações"
        subtitle="Envie push e acompanhe o engajamento"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Composer */}
        <AdminCard title="Nova notificação" className="lg:col-span-1">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Público
              </label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="free">Gratuitos</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="risk">Em risco de churn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Título
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Bora treinar hoje? 💪"
                className="h-10 rounded-xl border-border bg-secondary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Mensagem
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva a mensagem…"
                className="min-h-24 rounded-xl border-border bg-secondary"
              />
            </div>
            <Button
              onClick={send}
              className="h-11 w-full gap-2 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" /> Enviar agora
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full gap-2 rounded-xl border-border"
              onClick={() => toast.info("Agendamento aberto")}
            >
              <Clock className="h-4 w-4" /> Agendar envio
            </Button>
          </div>
        </AdminCard>

        {/* History */}
        <AdminCard title="Enviadas recentemente" className="lg:col-span-2">
          <div className="space-y-2">
            {sent.map((n) => {
              const rate = Math.round((n.opened / n.reach) * 100);
              return (
                <div
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Bell className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UsersIcon className="h-3 w-3" /> {n.audience} • {n.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtNumber(n.reach)}</p>
                    <StatusPill tone={rate >= 50 ? "success" : "warning"}>{rate}% aberto</StatusPill>
                  </div>
                </div>
              );
            })}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
