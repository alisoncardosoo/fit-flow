import { Bell, Tag, Mail, Trophy, AlertTriangle, Send, Flame, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminPageHeader, AdminCard, AdminKpiCard, StatusPill } from "@/components/admin/AdminUI";
import {
  getAtRiskBuckets,
  getStreakBuckets,
  retentionSuggestions,
  relativeDays,
} from "@/lib/adminData";

const iconMap: Record<string, LucideIcon> = { bell: Bell, tag: Tag, mail: Mail, trophy: Trophy };

export default function AdminRetention() {
  const buckets = getAtRiskBuckets();
  const streaks = getStreakBuckets();
  const totalRisk = buckets.reduce((s, b) => s + b.users.length, 0);

  return (
    <div>
      <AdminPageHeader
        title="Retenção"
        subtitle="Identifique riscos e aja antes do churn"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminKpiCard label="Taxa de retenção" value="78.5%" delta={2.1} icon={<Trophy className="h-4 w-4" />} />
        <AdminKpiCard label="Churn mensal" value="3.4%" delta={-0.6} icon={<AlertTriangle className="h-4 w-4" />} invertDelta />
        <AdminKpiCard label="Usuários em risco" value={String(totalRisk)} delta={-4.2} icon={<AlertTriangle className="h-4 w-4" />} invertDelta />
        <AdminKpiCard label="Reativados (30d)" value="312" delta={9.8} icon={<Bell className="h-4 w-4" />} />
      </div>

      {/* At-risk buckets */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b) => (
          <AdminCard key={b.label}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{b.label}</p>
              <StatusPill tone={b.color as "warning" | "destructive"}>
                {b.users.length}
              </StatusPill>
            </div>
            <div className="mt-3 flex -space-x-2">
              {b.users.slice(0, 5).map((u) => (
                <Avatar key={u.id} className="h-8 w-8 ring-2 ring-card">
                  <AvatarImage src={u.avatar} alt={u.name} />
                  <AvatarFallback className="bg-secondary text-[10px]">
                    {u.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {b.users.length > 5 && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold ring-2 ring-card">
                  +{b.users.length - 5}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-1.5 rounded-lg border-border"
              onClick={() => toast.success(`Campanha enviada para ${b.users.length} usuários`)}
            >
              <Send className="h-3.5 w-3.5" /> Reengajar
            </Button>
          </AdminCard>
        ))}
      </div>

      {/* Streaks */}
      <AdminCard title="Streaks" subtitle="Usuários em sequência de treinos" className="mt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {streaks.map((s) => (
            <div
              key={s.min}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Flame className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-xl font-bold tracking-tight">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Suggestions */}
        <AdminCard title="Sugestões automáticas" subtitle="Ações recomendadas pelo sistema">
          <div className="space-y-2">
            {retentionSuggestions.map((s, i) => {
              const Icon = iconMap[s.icon] ?? Bell;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{s.title}</p>
                      <StatusPill tone={s.impact === "Alto" ? "success" : "warning"}>
                        {s.impact}
                      </StatusPill>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={() => toast.success("Ação aplicada")}
                  >
                    Aplicar
                  </Button>
                </div>
              );
            })}
          </div>
        </AdminCard>

        {/* Recent at-risk list */}
        <AdminCard title="Usuários em maior risco" subtitle="Maior tempo sem acesso">
          <div className="space-y-2">
            {buckets[3].users.slice(0, 6).map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/40 p-2.5"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar} alt={u.name} />
                  <AvatarFallback className="bg-secondary text-xs">{u.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <StatusPill tone="destructive">{relativeDays(u.lastSeenAt)}</StatusPill>
              </div>
            ))}
            {buckets[3].users.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum usuário neste grupo. 🎉
              </p>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
