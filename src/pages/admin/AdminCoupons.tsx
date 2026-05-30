import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Ticket, Copy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import {
  fetchCoupons,
  createCoupon,
  toggleCoupon,
  type CouponInput,
} from "@/services/admin.service";
import { couponTypeLabel, couponValueDisplay, fmtDate, fmtNumber } from "@/lib/adminData";

export default function AdminCoupons() {
  const qc = useQueryClient();
  const couponsQ = useQuery({ queryKey: ["admin", "coupons"], queryFn: fetchCoupons });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CouponInput>({ code: "", type: "percent", value: 10, maxUses: 0 });

  const createMut = useMutation({
    mutationFn: createCoupon,
    onSuccess: () => {
      toast.success("Cupom criado");
      qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
      setOpen(false);
      setForm({ code: "", type: "percent", value: 10, maxUses: 0 });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar cupom"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleCoupon(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "coupons"] }),
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar"),
  });

  const coupons = couponsQ.data ?? [];
  const totalUses = coupons.reduce((s, c) => s + c.uses, 0);
  const active = coupons.filter((c) => c.active).length;

  return (
    <div>
      <AdminPageHeader
        title="Cupons"
        subtitle="Promoções e códigos de desconto"
        actions={
          <Button className="h-10 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Criar cupom
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <AdminKpiCard label="Cupons ativos" value={String(active)} icon={<Ticket className="h-4 w-4" />} />
        <AdminKpiCard label="Usos totais" value={fmtNumber(totalUses)} icon={<Ticket className="h-4 w-4" />} />
        <AdminKpiCard label="Total de cupons" value={String(coupons.length)} icon={<Ticket className="h-4 w-4" />} />
      </div>

      <AdminCard className="mt-4">
        {couponsQ.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <AdminSkeleton key={i} className="h-12" />)}</div>
        ) : couponsQ.isError ? (
          <AdminErrorState message={(couponsQ.error as Error)?.message} onRetry={() => couponsQ.refetch()} />
        ) : coupons.length === 0 ? (
          <AdminEmptyState
            icon={<Ticket className="h-5 w-5" />}
            title="Nenhum cupom criado"
            description="Crie seu primeiro cupom de desconto para começar."
            action={<Button size="sm" className="rounded-lg bg-primary text-primary-foreground" onClick={() => setOpen(true)}>Criar cupom</Button>}
          />
        ) : (
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
                    <TableHead className="text-right">Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => {
                    const pct = c.maxUses > 0 ? Math.round((c.uses / c.maxUses) * 100) : 0;
                    return (
                      <TableRow key={c.id} className="border-border/60">
                        <TableCell>
                          <button
                            className="flex items-center gap-1.5 font-mono text-sm font-semibold"
                            onClick={() => { navigator.clipboard?.writeText(c.code); toast.success("Código copiado"); }}
                          >
                            {c.code}
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{couponTypeLabel[c.type]}</TableCell>
                        <TableCell className="text-sm font-medium">{couponValueDisplay(c.type, c.value)}</TableCell>
                        <TableCell>
                          <div className="w-28">
                            <div className="mb-0.5 text-xs">
                              {fmtNumber(c.uses)} / {c.maxUses > 0 ? fmtNumber(c.maxUses) : "∞"}
                            </div>
                            {c.maxUses > 0 && (
                              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.expiresAt ? fmtDate(c.expiresAt) : "Sem prazo"}</TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={c.active}
                            onCheckedChange={(v) => toggleMut.mutate({ id: c.id, active: v })}
                            aria-label={`Ativar cupom ${c.code}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </AdminCard>

      {/* Dialog: criar cupom */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cupom</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Código</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="BEMVINDO20"
                className="h-10 rounded-xl border-border bg-secondary font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CouponInput["type"] })}>
                  <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    <SelectItem value="trial">Trial (dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor</label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="h-10 rounded-xl border-border bg-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Limite de uso (0 = ∞)</label>
                <Input type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} className="h-10 rounded-xl border-border bg-secondary" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Plano (opcional)</label>
                <Select value={form.planCode ?? "all"} onValueChange={(v) => setForm({ ...form, planCode: v === "all" ? null : v })}>
                  <SelectTrigger className="h-10 rounded-xl border-border bg-secondary text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Validade (opcional)</label>
              <Input
                type="date"
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="h-10 rounded-xl border-border bg-secondary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl border-border" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              disabled={!form.code.trim() || createMut.isPending}
              onClick={() => createMut.mutate(form)}
            >
              {createMut.isPending ? "Criando…" : "Criar cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
