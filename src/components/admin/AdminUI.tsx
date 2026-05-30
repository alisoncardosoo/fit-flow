import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";

// ---------------------------------------------
// Page header — title, subtitle and optional actions slot.
// ---------------------------------------------
export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------
// KPI card — value, % delta, trend direction and an optional sparkline.
// ---------------------------------------------
export function AdminKpiCard({
  label,
  value,
  delta,
  icon,
  spark,
  invertDelta = false,
}: {
  label: string;
  value: string;
  /** % variation. Pass undefined/null to hide the trend chip entirely. */
  delta?: number | null;
  icon: ReactNode;
  spark?: number[];
  /** When true, a negative delta is "good" (e.g. churn). */
  invertDelta?: boolean;
}) {
  const hasDelta = delta !== undefined && delta !== null && delta !== 0;
  const positive = invertDelta ? (delta ?? 0) < 0 : (delta ?? 0) >= 0;
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }));
  // Sanitize for a valid SVG gradient id (no spaces/parens).
  const gradId = `spark-${label.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="card-premium relative overflow-hidden rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {hasDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta as number).toFixed(1)}%
          </span>
        ) : (
          <span />
        )}

        {sparkData.length > 0 && (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(88 100% 76%)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(88 100% 76%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(88 100% 76%)"
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------
// Generic status pill with semantic tones.
// ---------------------------------------------
type Tone = "success" | "warning" | "destructive" | "muted" | "primary";

const toneClass: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-secondary text-muted-foreground",
  primary: "bg-primary/15 text-primary",
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------
// Skeleton — shimmer placeholder while data loads.
// ---------------------------------------------
export function AdminSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-secondary/70",
        className,
      )}
    />
  );
}

/** Grid of KPI-card-sized skeletons. */
export function AdminKpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <AdminSkeleton key={i} className="h-[104px]" />
      ))}
    </div>
  );
}

// ---------------------------------------------
// Error state — shown when a query fails (e.g. RLS/permission).
// ---------------------------------------------
export function AdminErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold">Não foi possível carregar os dados</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {message || "Verifique sua conexão e se você tem permissão de acesso."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold transition hover:bg-secondary/70"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------
// Empty state — friendly placeholder for no-data lists/tables.
// ---------------------------------------------
export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------------------------------------------
// Section card wrapper — used for charts and tables.
// ---------------------------------------------
export function AdminCard({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("card-premium rounded-2xl p-4 sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
