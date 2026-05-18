import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { ReactionBar } from "@/components/ReactionBar";
import { NotificationBell } from "@/components/NotificationBell";
import { getReactionsBatch, type ReactionEmoji } from "@/lib/social";

type Session = {
  id: string;
  workout_name: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume: number | null;
  user_id: string;
  display_name?: string;
  is_mine: boolean;
};

export default function History() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<Record<string, { emoji: ReactionEmoji; from_user_id: string }[]>>({});

  useEffect(() => { if (user) void load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    // RLS allows seeing own + friends' sessions
    const { data } = await supabase
      .from("workout_sessions")
      .select("id, workout_name, started_at, duration_seconds, total_volume, user_id")
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(80);

    const list = data ?? [];
    const otherIds = Array.from(new Set(list.filter((s) => s.user_id !== user.id).map((s) => s.user_id)));
    const profMap = new Map<string, string>();
    if (otherIds.length) {
      const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: otherIds });
      for (const p of (profs ?? []) as { user_id: string; display_name: string | null }[]) {
        profMap.set(p.user_id, p.display_name ?? "Atleta");
      }
    }

    const enriched: Session[] = list.map((s) => ({
      ...s,
      is_mine: s.user_id === user.id,
      display_name: s.user_id === user.id ? "Você" : profMap.get(s.user_id) ?? "Atleta",
    }));
    setSessions(enriched);

    const reactMap = await getReactionsBatch(enriched.map((s) => s.id));
    setReactions(reactMap);
    setLoading(false);
  }

  return (
    <div className="px-5 safe-top">
      <PageHeader
        eyebrow="Suas sessões"
        title="Histórico"
        subtitle="Todos os treinos finalizados"
        backTo="/workouts"
        actions={<NotificationBell />}
      />

      <div className="space-y-3 pb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)
        ) : sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum treino concluído ainda</p>
          </div>
        ) : (
          sessions.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="card-premium rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.workout_name}</span>
                    {!s.is_mine && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {s.display_name}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(s.started_at), "EEEE, d 'de' MMM", { locale: ptBR })}
                  </div>
                </div>
                <span className="text-xs font-bold text-primary">
                  {format(new Date(s.started_at), "HH:mm")}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round((s.duration_seconds ?? 0) / 60)} min</span>
                <span className="flex items-center gap-1"><Dumbbell className="h-3 w-3" /> {Number(s.total_volume ?? 0).toLocaleString("pt-BR")} kg</span>
              </div>
              <div className="mt-3 border-t border-border/40 pt-3">
                <ReactionBar sessionId={s.id} initial={reactions[s.id] ?? []} size="sm" />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
