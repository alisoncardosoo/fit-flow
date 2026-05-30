import { Plus, Ticket, Copy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, AdminKpiCard, StatusPill } from "@/components/admin/AdminUI";
import { coupons, fmtDate, type CouponType } from "@/lib/adminData";

const typeLabel: Record<CouponType, string> = {
  percent: "Percentual",
  fixed: "Valor fixo",
  trial: "Trial estendido",
};

function valueDisplay(type: CouponType, value: number) {
  if (type === "percent") return `${value}%`;
  if (type === "fixed") return `R$ ${value}`;
  return `${value} dias`;
}

export default function AdminCoupons() {
  const totalUses = coupons.reduce((s, c) => s + c.uses, 0);
  const active = coupons.filter((c) => c.active).length;

  return (
    <div>
      <AdminPageHeader
        title="Cupons"
        subtitle="Promoções e códigos de desconto"
        actions={
          <Button
            className="h-10 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => toast.success("Novo cupom")}
          >
            <Plus className="h-4 w-4" /> Criar cupom
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <AdminKpiCard label="Cupons ativos" value={String(active)} delta={0} icon={<Ticket className="h-4 w-4" />} />
        <AdminKpiCard label="Usos totais" value={totalUses.toLocaleString("pt-BR")} delta={14.2} icon={<Ticket className="h-4 w-4" />} />
        <AdminKpiCard label="Conversão via cupom" value="22%" delta={3.1} icon={<Ticket className="h-4 w-4" />} />
      </div>

      <AdminCard className="mt-4">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <div className="min-w-[760px] px-4 sm:px-5">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => {
                  const pct = Math.round((c.uses / c.maxUses) * 100);
                  return (
                    <TableRow key={c.id} className="border-border/60">
                      <TableCell>
                        <button
                          className="flex items-center gap-1.5 font-mono text-sm font-semibold"
                          onClick={() => {
                            navigator.clipboard?.writeText(c.code);
                            toast.success("Código copiado");
                          }}
                        >
                          {c.code}
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{typeLabel[c.type]}</TableCell>
                      <TableCell className="text-sm font-medium">{valueDisplay(c.type, c.value)}</TableCell>
                      <TableCell>
                        <div className="w-28">
                          <div className="mb-0.5 text-xs">
                            {c.uses.toLocaleString("pt-BR")} / {c.maxUses.toLocaleString("pt-BR")}
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(c.expiresAt)}</TableCell>
                      <TableCell>
                        <StatusPill tone={c.active ? "success" : "muted"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          defaultChecked={c.active}
                          onCheckedChange={(v) =>
                            toast.info(`Cupom ${c.code} ${v ? "ativado" : "desativado"}`)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
