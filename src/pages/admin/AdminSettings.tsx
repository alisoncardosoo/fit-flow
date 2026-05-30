import { Building2, CreditCard, Bell, Shield, Plug } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, StatusPill } from "@/components/admin/AdminUI";

function Field({ label, defaultValue, type = "text" }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input type={type} defaultValue={defaultValue} className="h-10 rounded-xl border-border bg-secondary" />
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch defaultChecked={defaultChecked} onCheckedChange={() => toast.success("Preferência salva")} />
    </div>
  );
}

const integrations = [
  { name: "Stripe", desc: "Pagamentos internacionais", connected: true },
  { name: "Mercado Pago", desc: "Pagamentos no Brasil", connected: true },
  { name: "OneSignal", desc: "Push notifications", connected: true },
  { name: "Google Analytics", desc: "Métricas de produto", connected: false },
];

export default function AdminSettings() {
  return (
    <div>
      <AdminPageHeader
        title="Configurações"
        subtitle="Preferências da plataforma"
        actions={
          <Button
            className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("Configurações salvas")}
          >
            Salvar alterações
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
            <Field label="Nome do app" defaultValue="FitFlow" />
            <Field label="E-mail de suporte" defaultValue="suporte@fitflow.app" type="email" />
            <Field label="URL do app" defaultValue="https://fitflow.app" />
          </div>
        </AdminCard>

        <AdminCard title="Planos e preços" subtitle="Valores de assinatura">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Monetização</span>
          </div>
          <div className="space-y-3">
            <Field label="Premium mensal (R$)" defaultValue="29.90" />
            <Field label="Premium anual (R$/mês)" defaultValue="24.90" />
            <Field label="Período de trial (dias)" defaultValue="7" />
          </div>
        </AdminCard>

        <AdminCard title="Notificações" subtitle="Preferências de envio">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Bell className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Comunicação</span>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Push de reengajamento" desc="Lembretes automáticos para inativos" defaultChecked />
            <ToggleRow label="Resumo semanal" desc="E-mail de progresso aos domingos" defaultChecked />
            <ToggleRow label="Alertas de churn" desc="Avisar quando um assinante cancela" defaultChecked />
          </div>
        </AdminCard>

        <AdminCard title="Segurança" subtitle="Acesso e proteção">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Conta</span>
          </div>
          <div className="space-y-2">
            <ToggleRow label="Autenticação em dois fatores" desc="Exigir 2FA para administradores" defaultChecked />
            <ToggleRow label="Logs de auditoria" desc="Registrar ações administrativas" defaultChecked />
            <ToggleRow label="Sessão expira em 24h" desc="Logout automático por inatividade" />
          </div>
        </AdminCard>

        <AdminCard title="Integrações" subtitle="Serviços conectados" className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Plug className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Conexões</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {integrations.map((i) => (
              <div
                key={i.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.desc}</p>
                </div>
                {i.connected ? (
                  <StatusPill tone="success">Conectado</StatusPill>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg border-border"
                    onClick={() => toast.success(`${i.name} conectado`)}
                  >
                    Conectar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
