import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, Trophy, Copy, Share2, UserPlus, Check, X, Flame, Crown, Medal,
  BarChart3, Swords,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import {
  buildInviteLink,
  respondToFriendRequest,
  removeFriend,
  type Friend, type RankingRow,
} from "@/lib/social";
import { fetchSocialData } from "@/services/social.service";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [removingFriendshipId, setRemovingFriendshipId] = useState<string | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["social-page", user?.id],
    queryFn: () => fetchSocialData(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });

  const code = data?.code ?? "";
  const friends: Friend[] = data?.friends ?? [];
  const ranking: RankingRow[] = data?.ranking ?? [];

  const reload = () => queryClient.invalidateQueries({ queryKey: ["social-page", user?.id] });

  const inviteLink = code ? buildInviteLink(code) : "";
  const acceptedFriends = friends.filter((f) => f.status === "accepted");
  const pendingIn = friends.filter((f) => f.status === "pending_in");
  const pendingOut = friends.filter((f) => f.status === "pending_out");

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  }
  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("Link copiado");
  }
  function shareWhatsApp() {
    const msg = encodeURIComponent(`Treine comigo no app 💪 ${inviteLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }
  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Treine comigo", text: "Treine comigo no app 💪", url: inviteLink });
      } catch { /* user cancelled */ }
    } else {
      await copyLink();
    }
  }

  async function handleRespond(id: string, accept: boolean) {
    try {
      await respondToFriendRequest(id, accept);
      toast.success(accept ? "Amizade aceita!" : "Convite recusado");
      await reload();
    } catch (e) {
      toast.error("Erro ao responder convite");
      console.error(e);
    }
  }

  async function performRemove(id: string) {
    try {
      await removeFriend(id);
      toast.success("Amizade removida");
      await reload();
    } catch {
      toast.error("Erro ao remover");
    }
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow="Sua rede"
        title="Social"
        subtitle="Treine, compita e acompanhe seus amigos"
      />

      {/* Invite card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 card-premium relative isolate overflow-hidden rounded-3xl p-5"
        style={{
          backgroundImage:
            "radial-gradient(120px 120px at calc(100% - 8px) -8px, hsl(var(--primary) / 0.18), transparent 70%), var(--gradient-card)",
        }}
      >
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seu código</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-40" />
          ) : (
            <button
              onClick={copyCode}
              className="mt-1 inline-flex items-center gap-2 font-display text-3xl font-extrabold tracking-[0.3em] text-foreground"
            >
              {code || "------"}
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Compartilhe o código ou link com seus amigos
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={shareNative} className="rounded-full bg-primary text-primary-foreground">
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
            <Button onClick={shareWhatsApp} variant="secondary" className="rounded-full">
              WhatsApp
            </Button>
            <Button onClick={copyLink} variant="ghost" className="rounded-full">
              <Copy className="mr-2 h-4 w-4" /> Copiar link
            </Button>
            <Button onClick={() => navigate("/social/add")} variant="ghost" className="rounded-full">
              <UserPlus className="mr-2 h-4 w-4" /> Inserir código
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Pending invites in */}
      {pendingIn.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Convites recebidos
          </h2>
          <div className="space-y-2">
            {pendingIn.map((f) => {
              const handle = f.username ?? f.display_name;
              return (
                <div key={f.friendship_id} className="card-premium flex items-center justify-between rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={handle} />
                    <div>
                      <p className="font-bold leading-tight">@{handle}</p>
                      <p className="text-xs text-muted-foreground">Quer ser seu amigo</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" onClick={() => handleRespond(f.friendship_id, true)} className="h-9 w-9 rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleRespond(f.friendship_id, false)} className="h-9 w-9 rounded-full">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Challenges shortcut */}
      <Link
        to="/challenges"
        className="card-premium mb-6 flex items-center justify-between rounded-3xl p-4 transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold leading-tight">Desafios</p>
            <p className="text-xs text-muted-foreground">Crie ou entre em uma competição</p>
          </div>
        </div>
        <Trophy className="h-5 w-5 text-muted-foreground" />
      </Link>

      {/* Tabs: ranking + friends */}
      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2 rounded-full bg-secondary p-1">
          <TabsTrigger value="ranking" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Trophy className="mr-2 h-4 w-4" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="friends" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="mr-2 h-4 w-4" /> Amigos {acceptedFriends.length > 0 && `(${acceptedFriends.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Ranking */}
        <TabsContent value="ranking" className="mt-0">
          <div className="card-premium rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Esta semana</p>
                <h3 className="font-display text-lg font-extrabold">Quem treina mais</h3>
              </div>
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : ranking.length === 0 ? (
              <EmptyState message="Adicione amigos para começar a competir." />
            ) : (
              <ol className="space-y-2">
                {ranking.map((row, i) => (
                  <RankingItem key={row.user_id} row={row} position={i + 1} isMe={row.user_id === user?.id} />
                ))}
              </ol>
            )}
          </div>
        </TabsContent>

        {/* Friends */}
        <TabsContent value="friends" className="mt-0 space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </>
          ) : acceptedFriends.length === 0 ? (
            <div className="card-premium rounded-3xl p-8">
              <EmptyState
                message="Você ainda não tem amigos. Compartilhe seu código!"
                action={
                  <Button onClick={() => navigate("/social/add")} className="rounded-full bg-primary text-primary-foreground">
                    <UserPlus className="mr-2 h-4 w-4" /> Adicionar amigo
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {acceptedFriends.map((f) => (
                <FriendItem key={f.friendship_id} friend={f} onRemove={() => setRemovingFriendshipId(f.friendship_id)} />
              ))}
              {pendingOut.length > 0 && (
                <div className="pt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Convites pendentes
                  </p>
                  {pendingOut.map((f) => {
                    const handle = f.username ?? f.display_name;
                    return (
                      <div key={f.friendship_id} className="card-premium mb-2 flex items-center justify-between rounded-2xl p-4 opacity-60">
                        <div className="flex items-center gap-3">
                          <Avatar name={handle} />
                          <div>
                            <p className="font-bold leading-tight">@{handle}</p>
                            <p className="text-xs text-muted-foreground">Aguardando resposta…</p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setRemovingFriendshipId(f.friendship_id)} className="rounded-full">
                          Cancelar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!removingFriendshipId}
        onOpenChange={(o) => !o && setRemovingFriendshipId(null)}
        title="Remover amizade?"
        description="Vocês deixarão de se ver no ranking e nos treinos ao vivo."
        confirmLabel="Remover"
        destructive
        onConfirm={async () => {
          if (removingFriendshipId) await performRemove(removingFriendshipId);
          setRemovingFriendshipId(null);
        }}
      />
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "U";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 font-display font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function FriendItem({ friend, onRemove }: { friend: Friend; onRemove: () => void }) {
  const lastTxt = friend.last_session_at
    ? `Último treino ${formatDistanceToNow(new Date(friend.last_session_at), { addSuffix: true, locale: ptBR })}`
    : "Sem treinos ainda";
  const handle = friend.username ?? friend.display_name;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium flex items-center justify-between rounded-2xl p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar name={handle} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
              friend.is_training_now ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold leading-tight">@{handle}</p>
          <p className="truncate text-xs text-muted-foreground">
            {friend.is_training_now ? "Treinando agora" : lastTxt}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {friend.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-500">
            <Flame className="h-3 w-3" /> {friend.streak}
          </span>
        )}
        <Link
          to={`/social/compare/${friend.user_id}`}
          aria-label="Comparar"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition hover:bg-primary/15 hover:text-primary"
        >
          <BarChart3 className="h-4 w-4" />
        </Link>
        <button onClick={onRemove} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

function RankingItem({ row, position, isMe }: { row: RankingRow; position: number; isMe: boolean }) {
  const medal =
    position === 1 ? <Crown className="h-5 w-5 text-yellow-500" /> :
    position === 2 ? <Medal className="h-5 w-5 text-slate-300" /> :
    position === 3 ? <Medal className="h-5 w-5 text-orange-400" /> :
    <span className="font-display text-sm font-bold text-muted-foreground">{position}</span>;

  const handle = row.username ?? row.display_name;

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: position * 0.04 }}
      className={`flex items-center gap-3 rounded-2xl p-3 ${
        isMe ? "bg-primary/15 ring-1 ring-primary/30" : "bg-secondary/50"
      }`}
    >
      <div className="flex h-8 w-8 items-center justify-center">{medal}</div>
      <Avatar name={handle} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold leading-tight">
          @{handle} {isMe && <span className="text-xs text-primary">(você)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.sessions} treino{row.sessions !== 1 ? "s" : ""} · {Math.round(Number(row.total_volume))} kg
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-lg font-extrabold tabular-nums">{row.points}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">pts</p>
      </div>
    </motion.li>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Users className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
