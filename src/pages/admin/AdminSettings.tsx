import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Bell, Shield, Plug } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, StatusPill, AdminSkeleton } from "@/components/admin/AdminUI";
import { fetchSetting, saveSetting } from "@/services/admin.service";

interface GeneralSettings {
  appName: string;
  supportEmail: string;
  appUrl: string;
  premiumMonthly: string;
  premiumAnnual: string;
  trialDays: string;
  pushReengagement: boolean;
  weeklyDigest: boolean;
  churnAlerts: boolean;
  twoFactor: boolean;
  auditLogs: boolean;
}

const DEFAULTS: GeneralSettings = {
  appName: "FitFlow",
  supportEmail: "suporte@fitflow.com.br",
  appUrl: "https://fitflow.app",
  premiumMonthly: "29.90",
  premiumAnnual: "24.90",
  trialDays: "7",
  pushReengagement: true,
  weeklyDigest: true,
  churnAlerts: true,
  twoFactor: false,
  auditLogs: true,
};

const SETTINGS_KEY = "general";

export default function AdminSettings() {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ["admin", "settings", SETTINGS_KEY],
    queryFn: () => fetchSetting<GeneralSettings>(SETTINGS_KEY),
  });

  const [form, setForm] = useState<GeneralSettings>(DEFAULTS);

  useEffect(() => {
    if (settingsQ.data) setForm({ ...DEFAULTS, ...settingsQ.data });
  }, [settingsQ.data]);

  const saveMut = useMutation({
    mutationFn: () => saveSetting(SETTINGS_KEY, form),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["admin", "settings", SETTINGS_KEY] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (settingsQ.isLoading) {
    return (
      <div>
        <AdminPageHeader title="Configurações" subtitle="Preferências da plataforma" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <AdminSkeleton key={i} className="h-56" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Configurações"
        subtitle="Preferências da plataforma"
        actions={
          <Button
            className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Dados da empresa" subtitle="Informações do negócio">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Geral</span>
          </div>
          <div className="space-y-3">
            <Field label="Nome do app" value={form.appName} onChange={(v) => set("appName", v)} />
            <Field label="E-mail de suporte" value={form.supportEmail} onChange={(v) => set("supportEmail", v)} type="email" />
            <Field label="URL do app" value={form.appUrl} onChange={(v) => set("appUrl", v)} />
          </div>
        </AdminCard>

        <AdminCard title="Planos e preços" subtitle="Valores de assinatura">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Monetização</span>
          </div>
          <div className="space-y-3">
            <Field label="Premium mensal (R$)" value={form.premiumMonthly} onChange={(v) => set("premiumMonthly", v)} />
            <Field label="Premium anual (R$/mês)" value={form.premiumAnnual} onChange={(v) => set("premiumAnnual", v)} />
            <Field label="Período de trial (dias)" value={form.trialDays} onChange={(v) => set("trialDays", v)} />
          </div>
        </AdminCard>

        <AdminCard title="Notificações" subtitle="Preferências de envio">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Bell className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Comunicação</span>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Push de reengajamento" desc="Lembretes automáticos para inativos" checked={form.pushReengagement} onChange={(v) => set("pushReengagement", v)} />
            <ToggleRow label="Resumo semanal" desc="E-mail de progresso aos domingos" checked={form.weeklyDigest} onChange={(v) => set("weeklyDigest", v)} />
            <ToggleRow label="Alertas de churn" desc="Avisar quando um assinante cancela" checked={form.churnAlerts} onChange={(v) => set("churnAlerts", v)} />
          </div>
        </AdminCard>

        <AdminCard title="Segurança" subtitle="Acesso e proteção">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Conta</span>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Autenticação em dois fatores" desc="Exigir 2FA para administradores" checked={form.twoFactor} onChange={(v) => set("twoFactor", v)} />
            <ToggleRow label="Logs de auditoria" desc="Registrar ações administrativas" checked={form.auditLogs} onChange={(v) => set("auditLogs", v)} />
          </div>
        </AdminCard>

        <AdminCard title="Integrações" subtitle="Serviços conectados" className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Plug className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Conexões</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { name: "Stripe", desc: "Pagamentos internacionais" },
              { name: "Mercado Pago", desc: "Pagamentos no Brasil" },
              { name: "OneSignal", desc: "Push notifications" },
              { name: "Google Analytics", desc: "Métricas de produto" },
            ].map((i) => (
              <div key={i.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
                <div>
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.desc}</p>
                </div>
                <StatusPill tone="muted">Não configurado</StatusPill>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl border-border bg-secondary" />
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
