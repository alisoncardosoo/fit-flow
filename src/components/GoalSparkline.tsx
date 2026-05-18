import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type SparklinePoint = { date: string; value: number };

interface Props {
  data: SparklinePoint[];
  /** Color hue based on trend status; defaults to primary. */
  variant?: "improving" | "stagnant" | "regressing" | "neutral";
  height?: number;
  unit?: string;
  targetValue?: number;
  /**
   * Reference line representing the ideal pace from start_value (created_at)
   * to target_value (deadline). Plotted as a dashed secondary line so the user
   * can compare actual progress vs. expected pace.
   */
  idealLine?: SparklinePoint[];
}

const variantColor: Record<NonNullable<Props["variant"]>, string> = {
  improving: "hsl(var(--success))",
  stagnant: "hsl(var(--muted-foreground))",
  regressing: "hsl(var(--destructive))",
  neutral: "hsl(var(--primary))",
};

type MergedRow = { date: string; value?: number; ideal?: number };

function mergeSeries(real: SparklinePoint[], ideal: SparklinePoint[] | undefined): MergedRow[] {
  if (!ideal || ideal.length === 0) {
    return real.map((p) => ({ date: p.date, value: p.value }));
  }
  const map = new Map<string, MergedRow>();
  for (const p of ideal) map.set(p.date, { date: p.date, ideal: p.value });
  for (const p of real) {
    const row = map.get(p.date) ?? { date: p.date };
    row.value = p.value;
    map.set(p.date, row);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function GoalSparkline({
  data,
  variant = "neutral",
  height = 40,
  unit = "",
  targetValue,
  idealLine,
}: Props) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-xl bg-muted/30 text-[10px] font-medium text-muted-foreground"
        style={{ height }}
      >
        Ainda sem histórico suficiente
      </div>
    );
  }

  const stroke = variantColor[variant];
  const gradId = `spark-grad-${variant}-${data.length}`;
  const merged = mergeSeries(data, idealLine);
  const hasIdeal = !!idealLine && idealLine.length >= 2;

  return (
    <div className="w-full">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="100%" stopColor={stroke} stopOpacity={1} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
                padding: "6px 8px",
                color: "hsl(var(--popover-foreground))",
              }}
              labelFormatter={(label) =>
                format(new Date(label as string), "d 'de' MMM", { locale: ptBR })
              }
              formatter={(value, name) => {
                const num = Number(value);
                const formatted = `${num.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${
                  unit ? " " + unit : ""
                }`;
                const label = name === "ideal" ? "Ritmo ideal" : "Real";
                return [formatted, label];
              }}
            />
            {hasIdeal && (
              <Line
                type="linear"
                dataKey="ideal"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive
                animationDuration={500}
                connectNulls
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={`url(#${gradId})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={600}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasIdeal && (
        <div className="mt-1 flex items-center justify-end gap-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-[2px] w-3 rounded-full" style={{ background: stroke }} />
            Real
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-[2px] w-3 rounded-full"
              style={{ background: "hsl(var(--muted-foreground))", opacity: 0.6 }}
            />
            Ritmo ideal
            {targetValue != null && (
              <span className="opacity-60">
                · {targetValue} {unit}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
