import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, UserPlus, UserMinus, ArrowUpCircle } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdminPageHeader,
  AdminCard,
  AdminKpiCard,
  AdminKpiSkeleton,
  AdminSkeleton,
  StatusPill,
  AdminEmptyState,
} from "@/components/admin/AdminUI";
import {
  fetchAdminKpis,
  fetchRevenueMonthly,
  fetchSubscriptionEvents,
} from "@/services/admin.service";
import {
  fmtCents,
  shortMonth,
  subEventLabel,
  subEventTone,
  fmtDate,
} from "@/lib/adminData";

export default function AdminSubscriptions() {
  const kpisQ = useQuery({ queryKey: ["admin", "kpis"], queryFn: fetchAdminKpis });
  const revenueQ = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => fetchRevenueMonthly(12) });
  const eventsQ = useQuery({ queryKey: ["admin", "sub-events"], queryFn: fetchSubscriptionEvents });

  const k = kpisQ.data;
  const events = eventsQ.data ?? [];
  const counts = events.reduce((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  // Considera um gateway "conectado" quando já recebeu ao menos um evento.
  const stripeConnected = events.some((e) => e.gateway === "stripe");
  const mpConnected = events.some((e) => e.gateway === "mercadopago");

  return (
    <div>
      <AdminPageHeader
        title="Assinaturas"
        subtitle="Dashboard financeiro • integração Stripe e Mercado Pago"
      />

      {kpisQ.isLoading ? (
        <AdminKpiSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <AdminKpiCard label="MRR — Receita recorrente mensal" value={fmtCents(k?.mrrCents ?? 0)} icon={<DollarSign className="h-4 w-4" />} spark={(revenueQ.data ?? []).map((r) => r.revenueCents)} />
          <AdminKpiCard label="ARR — Receita anual" value={fmtCents(k?.arrCents ?? 0)} icon={<TrendingUp className="h-4 w-4" />} />
          <AdminKpiCard label="Assinantes ativos" value={String(k?.activeSubscribers ?? 0)} icon={<UserPlus className="h-4 w-4" />} />
          <AdminKpiCard label="Novas assinaturas" value={String(counts.new ?? 0)} icon={<UserPlus className="h-4 w-4" />} />
          <AdminKpiCard label="Cancelamentos" value={String(counts.canceled ?? 0)} icon={<UserMinus className="h-4 w-4" />} />
          <AdminKpiCard label="Upgrades / Downgrades" value={`${counts.upgrade ?? 0} / ${counts.downgrade ?? 0}`} icon={<ArrowUpCircle className="h-4 w-4" />} />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AdminCard title="Evolução da receita recorrente" subtitle="Últimos 12 meses" className="lg:col-span-2">
          {revenueQ.isLoading ? (
            <AdminSkeleton className="h-64" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(revenueQ.data ?? []).map((r) => ({ mes: shortMonth(r.month), receita: r.revenueCents / 100 }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(88 100% 76%)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(88 100% 76%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip contentStyle={{ background: "hsl(140 8% 9%)", border: "1px solid hsl(140 6% 18%)", borderRadius: 12, fontSize: 12 }} formatter={(v) => fmtCents(Number(v) * 100)} />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(88 100% 76%)" strokeWidth={2.5} fill="url(#mrrFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard title="Gateways" subtitle="Status da integração">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/40 p-3">
              <span className="font-medium">Stripe</span>
              <StatusPill tone={stripeConnected ? "success" : "muted"}>
                {stripeConnected ? "Recebendo eventos" : "Aguardando webhook"}
              </StatusPill>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/40 p-3">
              <span className="font-medium">Mercado Pago</span>
              <StatusPill tone={mpConnected ? "success" : "muted"}>
                {mpConnected ? "Recebendo eventos" : "Aguardando webhook"}
              </StatusPill>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Os webhooks <span className="font-mono">stripe-webhook</span> e{" "}
            <span className="font-mono">mercadopago-webhook</span> registram assinaturas e
            receita automaticamente. Veja PAYMENTS_SETUP.md para configurar.
          </p>
        </AdminCard>
      </div>

      <AdminCard title="Transações recentes" className="mt-4">
        {eventsQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <AdminSkeleton key={i} className="h-12" />)}
          </div>
        ) : events.length === 0 ? (
          <AdminEmptyState
            icon={<DollarSign className="h-5 w-5" />}
            title="Nenhuma transação ainda"
            description="As transações aparecerão aqui quando houver assinaturas pagas."
          />
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <div className="min-w-[600px] px-4 sm:px-5">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Evento</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id} className="border-border/60">
                      <TableCell>
                        <StatusPill tone={subEventTone[e.eventType] ?? "muted"}>
                          {subEventLabel[e.eventType] ?? e.eventType}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-sm capitalize text-muted-foreground">
                        {e.gateway === "mercadopago" ? "Mercado Pago" : e.gateway}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{fmtCents(e.amountCents)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{fmtDate(e.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
