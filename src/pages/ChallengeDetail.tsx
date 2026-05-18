import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Crown, Medal, Calendar, Users, Trash2, LogOut, LogIn, Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getChallenge, getChallengeLeaderboard, joinChallenge, leaveChallenge, deleteChallenge,
  CHALLENGE_TYPE_LABEL, CHALLENGE_TYPE_UNIT,
  type Challenge, type LeaderboardRow,
} from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    void load();

    const ch = supabase
      .channel(`challenge-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenge_participants", filter: `challenge_id=eq.${id}` },
        () => void refreshBoard(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function load() {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [c, b] = await Promise.all([getChallenge(id), getChallengeLeaderboard(id, user.id)]);
      setChallenge(c);
      setBoard(b);
    } finally {
      setLoading(false);
    }
  }

  async function refreshBoard() {
    if (!id || !user) return;
    const b = await getChallengeLeaderboard(id, user.id);
    setBoard(b);
  }

  async function handleJoin() {
    if (!id || !user) return;
    setBusy(true);
    try { await joinChallenge(id, user.id); toast.success("Você entrou no desafio!"); await load(); }
    catch { toast.error("Erro ao entrar"); }
    finally { setBusy(false); }
  }

  async function handleLeave() {
    if (!id || !user) return;
    if (!confirm("Sair do desafio?")) return;
    setBusy(true);
    try { await leaveChallenge(id, user.id); toast.success("Você saiu do desafio"); await load(); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm("Excluir desafio? Todos perderão o progresso.")) return;
    setBusy(true);
    try { await deleteChallenge(id); toast.success("Desafio excluído"); navigate("/challenges", { replace: true }); }
    finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="px-5 safe-top pb-dock space-y-4">
        <Skeleton className="h-12 w-3/4 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
        <Trophy className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Desafio não encontrado.</p>
        <Button onClick={() => navigate("/challenges")} variant="ghost">Voltar</Button>
      </div>
    );
  }

  const ends = new Date(challenge.ends_at);
  const starts = new Date(challenge.starts_at);
  const isActive = isAfter(ends, new Date());
  const isMine = challenge.creator_id === user?.id;
  const isJoined = board.some((b) => b.is_me);
  const myRow = board.find((b) => b.is_me);
  const myPosition = myRow ? board.findIndex((b) => b.is_me) + 1 : null;

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow={CHALLENGE_TYPE_LABEL[challenge.type]}
        title={challenge.title}
        backTo={-1}
      />

      {/* Meta */}
      <div className="card-premium mb-5 rounded-3xl p-5">
        {challenge.description && <p className="mb-3 text-sm text-muted-foreground">{challenge.description}</p>}
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Calendar className="h-4 w-4" />} label={isActive ? "Termina" : "Encerrado"}
            value={isActive ? formatDistanceToNow(ends, { locale: ptBR }) : format(ends, "dd/MM")} />
          <Stat icon={<Users className="h-4 w-4" />} label="Participantes" value={String(board.length)} />
          <Stat icon={<Trophy className="h-4 w-4" />} label="Sua posição" value={myPosition ? `${myPosition}º` : "—"} />
        </div>
        <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {format(starts, "dd MMM", { locale: ptBR })} – {format(ends, "dd MMM", { locale: ptBR })}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {!isJoined && isActive && (
            <Button onClick={handleJoin} disabled={busy} className="flex-1 rounded-full bg-primary text-primary-foreground">
              <LogIn className="mr-2 h-4 w-4" /> Entrar no desafio
            </Button>
          )}
          {isJoined && !isMine && (
            <Button onClick={handleLeave} disabled={busy} variant="ghost" className="flex-1 rounded-full">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          )}
          {isMine && (
            <Button onClick={handleDelete} disabled={busy} variant="ghost" className="flex-1 rounded-full text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Ranking</h2>
      <div className="card-premium rounded-3xl p-4">
        {board.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Ainda sem participantes.</p>
        ) : (
          <ol className="space-y-2">
            {board.map((row, i) => {
              const pos = i + 1;
              const medal =
                pos === 1 ? <Crown className="h-5 w-5 text-yellow-500" /> :
                pos === 2 ? <Medal className="h-5 w-5 text-slate-300" /> :
                pos === 3 ? <Medal className="h-5 w-5 text-orange-400" /> :
                <span className="font-display text-sm font-bold text-muted-foreground">{pos}</span>;
              return (
                <motion.li
                  key={row.user_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: pos * 0.04 }}
                  className={`flex items-center gap-3 rounded-2xl p-3 ${row.is_me ? "bg-primary/15 ring-1 ring-primary/30" : "bg-secondary/50"}`}
                >
                  <div className="flex h-8 w-8 items-center justify-center">{medal}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold leading-tight">
                      {row.display_name} {row.is_me && <span className="text-xs text-primary">(você)</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold tabular-nums">
                      {Math.round(row.score).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {CHALLENGE_TYPE_UNIT[challenge.type]}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-3">
      <div className="mb-1 flex justify-center text-muted-foreground">{icon}</div>
      <p className="font-display text-sm font-extrabold leading-tight">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
