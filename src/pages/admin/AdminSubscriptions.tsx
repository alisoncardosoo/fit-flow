import {
  DollarSign,
  TrendingUp,
  UserPlus,
  UserMinus,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
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
import { AdminPageHeader, AdminCard, AdminKpiCard, StatusPill } from "@/components/admin/AdminUI";
import {
  subscriptions,
  revenueMonthly,
  planLabel,
  subEventLabel,
  fmtCurrency,
  fmtDate,
  type SubscriptionEvent,
} from "@/lib/adminData";

const eventTone: Record<SubscriptionEvent, "success" | "primary" | "warning" | "destructive" | "muted"> = {
  new: "success",
  renewal: "primary",
  upgrade: "success",
  downgrade: "warning",
  canceled: "destructive",
};

export default function AdminSubscriptions() {
  const mrr = 58700;
  const counts = subscriptions.reduce(
    (acc, s) => {
      acc[s.event] = (acc[s.event] ?? 0) + 1;
      return acc;
    },
    {} as Record<SubscriptionEvent, number>,
  );

  return (
    <div>
      <AdminPageHeader
        title="Assinaturas"
        subtitle="Dashboard financeiro • integração Stripe e Mercado Pago"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <AdminKpiCard
          label="MRR — Receita recorrente mensal"
          value={fmtCurrency(mrr)}
          delta={9.3}
          icon={<DollarSign className="h-4 w-4" />}
          spark={revenueMonthly.map((r) => r.receita)}
        />
        <AdminKpiCard
          label="ARR — Receita anual"
          value={fmtCurrency(mrr * 12)}
          delta={11.5}
          icon={<TrendingUp className="h-4 w-4" />}
          spark={revenueMonthly.map((r) => r.receita * 12)}
        />
        <AdminKpiCard
          label="Ticket médio"
          value={fmtCurrency(28.4)}
          delta={1.2}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <AdminKpiCard
          label="Novas assinaturas"
          value={String((counts.new ?? 0) + 38)}
          delta={6.7}
          icon={<UserPlus className="h-4 w-4" />}
        />
        <AdminKpiCard
          label="Cancelamentos"
          value={String((counts.canceled ?? 0) + 5)}
          delta={-0.6}
          icon={<UserMinus className="h-4 w-4" />}
          invertDelta
        />
        <AdminKpiCard
          label="Upgrades / Downgrades"
          value={`${(counts.upgrade ?? 0) + 12} / ${(counts.downgrade ?? 0) + 4}`}
          delta={3.1}
          icon={<ArrowUpCircle className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AdminCard title="Evolução da receita recorrente" subtitle="Últimos 12 meses" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueMonthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(88 100% 76%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(88 100% 76%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(140 6% 16%)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(90 8% 55%)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(140 8% 9%)", border: "1px solid hsl(140 6% 18%)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => fmtCurrency(Number(v))}
                />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(88 100% 76%)" strokeWidth={2.5} fill="url(#mrrFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Gateways" subtitle="Distribuição de pagamentos">
          <div className="space-y-4">
            <GatewayRow name="Stripe" pct={62} amount={fmtCurrency(mrr * 0.62)} />
            <GatewayRow name="Mercado Pago" pct={38} amount={fmtCurrency(mrr * 0.38)} />
          </div>
          <div className="mt-6 rounded-xl border border-border/60 bg-secondary/40 p-3">
            <p className="text-xs font-semibold">Status da integração</p>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stripe</span>
                <StatusPill tone="success">Conectado</StatusPill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mercado Pago</span>
                <StatusPill tone="success">Conectado</StatusPill>
              </div>
            </div>
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Transações recentes" className="mt-4">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <div className="min-w-[720px] px-4 sm:px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.slice(0, 15).map((s) => (
                  <TableRow key={s.id} className="border-border/60">
                    <TableCell>
                      <p className="text-sm font-medium">{s.user}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{planLabel[s.plan]}</TableCell>
                    <TableCell>
                      <StatusPill tone={eventTone[s.event]}>{subEventLabel[s.event]}</StatusPill>
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {s.gateway === "mercadopago" ? "Mercado Pago" : "Stripe"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{fmtCurrency(s.amount)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {fmtDate(s.date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}

function GatewayRow({ name, pct, amount }: { name: string; pct: number; amount: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">{amount}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-right text-[11px] text-muted-foreground">{pct}%</p>
    </div>
  );
}
