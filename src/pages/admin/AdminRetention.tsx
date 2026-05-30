import { useQuery } from "@tanstack/react-query";
import { Bell, Tag, Mail, Trophy, AlertTriangle, Flame, type LucideIcon } from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminKpiCard,
  AdminKpiSkeleton,
  AdminSkeleton,
  StatusPill,
} from "@/components/admin/AdminUI";
import { fetchAtRiskCounts, fetchStreakBuckets, fetchAdminKpis } from "@/services/admin.service";
import { retentionSuggestions } from "@/lib/adminData";

const iconMap: Record<string, LucideIcon> = { bell: Bell, tag: Tag, mail: Mail, trophy: Trophy };

export default function AdminRetention() {
  const riskQ = useQuery({ queryKey: ["admin", "at-risk"], queryFn: fetchAtRiskCounts });
  const streakQ = useQuery({ queryKey: ["admin", "streaks"], queryFn: fetchStreakBuckets });
  const kpisQ = useQuery({ queryKey: ["admin", "kpis"], queryFn: fetchAdminKpis });

  const risk = riskQ.data;
  const totalRisk = risk ? risk.d3 + risk.d7 + risk.d15 + risk.d30 : 0;
  const k = kpisQ.data;
  const retentionRate =
    k && k.totalUsers > 0 ? ((k.activeUsers / k.totalUsers) * 100).toFixed(1) : "0";

  const riskBuckets = [
    { label: "Sem acesso há 3+ dias", value: risk?.d3 ?? 0, tone: "warning" as const },
    { label: "Sem acesso há 7+ dias", value: risk?.d7 ?? 0, tone: "warning" as const },
    { label: "Sem acesso há 15+ dias", value: risk?.d15 ?? 0, tone: "destructive" as const },
    { label: "Sem acesso há 30+ dias", value: risk?.d30 ?? 0, tone: "destructive" as const },
  ];

  const streakBuckets = [
    { label: "7 dias+", value: streakQ.data?.s7 ?? 0 },
    { label: "15 dias+", value: streakQ.data?.s15 ?? 0 },
    { label: "30 dias+", value: streakQ.data?.s30 ?? 0 },
    { label: "90 dias+", value: streakQ.data?.s90 ?? 0 },
  ];

  return (
    <div>
      <AdminPageHeader title="Retenção" subtitle="Identifique riscos e aja antes do churn" />

      {kpisQ.isLoading || riskQ.isLoading ? (
        <AdminKpiSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminKpiCard label="Taxa de retenção (30d)" value={`${retentionRate}%`} icon={<Trophy className="h-4 w-4" />} />
          <AdminKpiCard label="Usuários em risco" value={String(totalRisk)} icon={<AlertTriangle className="h-4 w-4" />} />
          <AdminKpiCard label="Usuários ativos" value={String(k?.activeUsers ?? 0)} icon={<Flame className="h-4 w-4" />} />
          <AdminKpiCard label="Total de usuários" value={String(k?.totalUsers ?? 0)} icon={<Bell className="h-4 w-4" />} />
        </div>
      )}

      {/* At-risk buckets */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {riskQ.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <AdminSkeleton key={i} className="h-24" />)
          : riskBuckets.map((b) => (
              <AdminCard key={b.label}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{b.label}</p>
                  <StatusPill tone={b.tone}>{b.value}</StatusPill>
                </div>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight">{b.value}</p>
                <p className="text-xs text-muted-foreground">usuários neste grupo</p>
              </AdminCard>
            ))}
      </div>

      {/* Streaks */}
      <AdminCard title="Streaks" subtitle="Usuários em sequência de treinos" className="mt-4">
        {streakQ.isLoading ? (
          <AdminSkeleton className="h-20" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {streakBuckets.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Flame className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-xl font-bold tracking-tight">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Suggestions */}
      <AdminCard title="Sugestões automáticas" subtitle="Ações recomendadas pelo sistema" className="mt-4">
        <div className="space-y-2">
          {retentionSuggestions.map((s, i) => {
            const Icon = iconMap[s.icon] ?? Bell;
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.title}</p>
                    <StatusPill tone={s.impact === "Alto" ? "success" : "warning"}>{s.impact}</StatusPill>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </AdminCard>
    </div>
  );
}
