import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listMeasurements, deleteMeasurement, type BodyMeasurement,
} from "@/services/measurements.service";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

export function BodyMeasurementHistory({ open, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      setItems(await listMeasurements(user.id, 90));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  async function handleDelete(id: string) {
    await deleteMeasurement(id);
    setItems((l) => l.filter((m) => m.id !== id));
    onChanged?.();
    toast.success("Medida removida");
  }

  // Chart data em ordem cronológica
  const chartData = [...items]
    .reverse()
    .map((m) => ({
      date: m.measured_at,
      weight: Number(m.weight),
      label: format(parseISO(m.measured_at), "d/MM", { locale: ptBR }),
    }));

  const first = items[items.length - 1]?.weight;
  const last = items[0]?.weight;
  const delta = first != null && last != null ? last - first : 0;
  const TrendIcon = delta > 0.1 ? TrendingUp : delta < -0.1 ? TrendingDown : Minus;
  const trendColor = delta > 0.1 ? "text-warning" : delta < -0.1 ? "text-success" : "text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-border/60 bg-popover p-0">
        <SheetHeader className="border-b border-border/60 px-5 pt-5 pb-4">
          <SheetTitle className="font-display text-lg font-extrabold">Histórico de peso</SheetTitle>
        </SheetHeader>

        <div className="px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma medida registrada ainda.
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Última medida</p>
                  <p className="font-display text-3xl font-extrabold">
                    {last?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    <span className="text-sm font-bold text-muted-foreground"> kg</span>
                  </p>
                </div>
                {items.length >= 2 && (
                  <div className={`flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-extrabold ${trendColor}`}>
                    <TrendIcon className="h-3.5 w-3.5" />
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)} kg
                  </div>
                )}
              </div>

              {chartData.length >= 2 && (
                <div className="mb-5 h-32 rounded-2xl bg-secondary/40 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(v) => [`${Number(v ?? 0).toFixed(1)} kg`, "Peso"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <ul className="divide-y divide-border/40">
                {items.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-bold">
                        {m.weight.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
                        {m.body_fat != null && (
                          <span className="ml-2 text-xs font-medium text-muted-foreground">
                            · {m.body_fat}% gordura
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                        {format(parseISO(m.measured_at), "EEEE, d 'de' MMM", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
