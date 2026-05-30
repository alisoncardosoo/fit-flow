import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Bell, Users as UsersIcon } from "lucide-react";
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
import {
  AdminPageHeader,
  AdminCard,
  StatusPill,
  AdminSkeleton,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import { fetchCampaigns, createCampaign, type CampaignInput } from "@/services/admin.service";
import { fmtNumber, relativeDays, channelLabel } from "@/lib/adminData";

const audienceLabel: Record<string, string> = {
  all: "Todos os usuários",
  active: "Ativos",
  inactive: "Inativos",
  free: "Gratuitos",
  premium: "Premium",
  risk: "Em risco de churn",
};

export default function AdminNotifications() {
  const qc = useQueryClient();
  const [form, setForm] = useState<CampaignInput>({ title: "", body: "", channel: "push", audience: "all" });

  const campaignsQ = useQuery({ queryKey: ["admin", "campaigns"], queryFn: fetchCampaigns });

  const sendMut = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      toast.success("Notificação registrada e enviada para a fila 🚀");
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setForm({ title: "", body: "", channel: "push", audience: "all" });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar"),
  });

  const send = () => {
    if (!form.title.trim()) return toast.error("Adicione um título");
    sendMut.mutate(form);
  };

  const campaigns = campaignsQ.data ?? [];

  return (
    <div>
      <AdminPageHeader title="Notificações" subtitle="Envie campanhas e acompanhe o engajamento" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Composer */}
        <AdminCard title="Nova notificação" className="lg:col-span-1">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Canal</label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as CampaignInput["channel"] })}>
                <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="in_app">Mensagem interna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Público</label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(audienceLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Título</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Bora treinar hoje? 💪"
                className="h-10 rounded-xl border-border bg-secondary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mensagem</label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Escreva a mensagem…"
                className="min-h-24 rounded-xl border-border bg-secondary"
              />
            </div>
            <Button
              onClick={send}
              disabled={sendMut.isPending}
              className="h-11 w-full gap-2 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" /> {sendMut.isPending ? "Enviando…" : "Enviar agora"}
            </Button>
          </div>
        </AdminCard>

        {/* History */}
        <AdminCard title="Enviadas recentemente" className="lg:col-span-2">
          {campaignsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <AdminSkeleton key={i} className="h-16" />)}</div>
          ) : campaigns.length === 0 ? (
            <AdminEmptyState
              icon={<Bell className="h-5 w-5" />}
              title="Nenhuma campanha enviada"
              description="Use o formulário ao lado para enviar sua primeira notificação."
            />
          ) : (
            <div className="space-y-2">
              {campaigns.map((n) => {
                const rate = n.reach > 0 ? Math.round((n.opened / n.reach) * 100) : 0;
                return (
                  <div key={n.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Bell className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UsersIcon className="h-3 w-3" /> {audienceLabel[n.audience] ?? n.audience} • {channelLabel[n.channel] ?? n.channel}
                        {n.sentAt && ` • ${relativeDays(n.sentAt)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmtNumber(n.reach)}</p>
                      {n.reach > 0 && <StatusPill tone={rate >= 50 ? "success" : "warning"}>{rate}% aberto</StatusPill>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
