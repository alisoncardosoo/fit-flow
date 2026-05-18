import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, BellOff, Check, CheckCheck, Heart, Trophy, Users, Dumbbell, Sparkles, Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications, countUnread, markAllRead, markRead, clearAll,
  type AppNotification, type NotificationType,
} from "@/lib/notifications";
import {
  Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const typeIcon: Record<NotificationType, JSX.Element> = {
  friend_request: <Users className="h-4 w-4" />,
  friend_accepted: <Check className="h-4 w-4" />,
  friend_workout: <Dumbbell className="h-4 w-4" />,
  reaction_received: <Heart className="h-4 w-4" />,
  challenge_invite: <Trophy className="h-4 w-4" />,
  challenge_overtaken: <Sparkles className="h-4 w-4" />,
  challenge_won: <Trophy className="h-4 w-4" />,
};

// Cores em tokens semânticos quando possível; mantemos cores específicas
// para diferenciar tipos (consistente com o resto do app que já usa
// rose/blue/etc nos gradientes de muscle-group).
const typeAccent: Record<NotificationType, string> = {
  friend_request: "bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/25",
  friend_accepted: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25",
  friend_workout: "bg-primary/15 text-primary ring-1 ring-primary/25",
  reaction_received: "bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/25",
  challenge_invite: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25",
  challenge_overtaken: "bg-red-500/15 text-red-300 ring-1 ring-red-500/25",
  challenge_won: "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/25",
};

const typeLabel: Record<NotificationType, string> = {
  friend_request: "Pedido de amizade",
  friend_accepted: "Nova amizade",
  friend_workout: "Treino do amigo",
  reaction_received: "Reação",
  challenge_invite: "Desafio",
  challenge_overtaken: "Desafio",
  challenge_won: "Desafio",
};

function bucketLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [pulse, setPulse] = useState(0); // forces re-mount of the pulse ring

  // React to global "flow:notif-bump" events fired by PushBridge so the bell
  // briefly pulses even before realtime delivers the row.
  useEffect(() => {
    const onBump = () => {
      setUnread((u) => u + 1); // optimistic — refresh below will reconcile
      setPulse((p) => p + 1);
    };
    window.addEventListener("flow:notif-bump", onBump);
    return () => window.removeEventListener("flow:notif-bump", onBump);
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void refresh();
          if (open) void loadList();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open]);

  async function refresh() {
    if (!user) return;
    const c = await countUnread(user.id);
    setUnread(c);
  }

  async function loadList() {
    if (!user) return;
    setLoading(true);
    try {
      const list = await listNotifications(user.id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  function getLink(n: AppNotification): string | null {
    const p = n.payload as Record<string, string> | null;
    switch (n.type) {
      case "friend_request":
      case "friend_accepted":
        return "/social";
      case "friend_workout":
      case "reaction_received":
        return "/history";
      case "challenge_invite":
      case "challenge_overtaken":
      case "challenge_won":
        return p?.challenge_id ? `/challenges/${p.challenge_id}` : "/challenges";
      default:
        return null;
    }
  }

  async function handleClick(n: AppNotification) {
    if (!n.read_at) {
      await markRead(n.id);
      setItems((l) => l.map((it) => (it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it)));
      setUnread((u) => Math.max(0, u - 1));
    }
  }

  async function handleMarkAll() {
    if (!user) return;
    await markAllRead(user.id);
    setUnread(0);
    setItems((l) => l.map((it) => ({ ...it, read_at: it.read_at ?? new Date().toISOString() })));
  }

  async function handleClearAll() {
    if (!user) return;
    await clearAll(user.id);
    setItems([]);
    setUnread(0);
  }

  const visibleItems = useMemo(
    () => (filter === "unread" ? items.filter((i) => !i.read_at) : items),
    [items, filter],
  );

  // Agrupa por dia para uma visualização mais legível
  const grouped = useMemo(() => {
    const groups: { label: string; items: AppNotification[] }[] = [];
    for (const n of visibleItems) {
      const label = bucketLabel(new Date(n.created_at));
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(n);
      else groups.push({ label, items: [n] });
    }
    return groups;
  }, [visibleItems]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) void loadList(); }}>
      <DialogTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition active:scale-95 hover:bg-secondary/80"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background"
              >
                {unread > 99 ? "99+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
          {unread > 0 && (
            <span
              key={pulse}
              className="absolute -right-0.5 -top-0.5 flex h-5 w-5 animate-ping rounded-full bg-primary/40"
              aria-hidden
            />
          )}
        </button>
      </DialogTrigger>

      <DialogContent
        className="left-1/2 top-1/2 w-[min(400px,calc(100vw-2rem))] max-w-[400px] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-3xl border-border/60 bg-popover p-0 shadow-elevated"
      >
        <DialogTitle className="sr-only">Notificações</DialogTitle>
        <DialogDescription className="sr-only">Lista de notificações do app</DialogDescription>
        {/* Header gradiente */}
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-4 pt-4 pb-3">
          <div className="absolute inset-0 bg-gradient-glow opacity-50" aria-hidden />
          <div className="relative flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-extrabold leading-tight">Notificações</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {unread > 0
                  ? `${unread} ${unread === 1 ? "nova" : "novas"} para você`
                  : "Você está em dia ✨"}
              </p>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAll}
                    title="Marcar todas como lidas"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  title="Limpar tudo"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tabs filtro */}
          {items.length > 0 && (
            <div className="relative mt-3 flex gap-1 rounded-full bg-secondary/60 p-1">
              {(["all", "unread"] as const).map((f) => {
                const active = filter === f;
                const label = f === "all" ? "Todas" : "Não lidas";
                const count = f === "unread" ? unread : items.length;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "relative flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition",
                      active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="notif-tab-pill"
                        className="absolute inset-0 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center justify-center gap-1.5">
                      {label}
                      {count > 0 && (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none",
                          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground",
                        )}>
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista */}
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 rounded-2xl p-2">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-full" />
                    <Skeleton className="h-2 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <BellOff className="h-7 w-7 text-muted-foreground/60" />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="h-3 w-3" />
                </span>
              </div>
              <p className="font-display text-base font-bold">
                {filter === "unread" ? "Tudo lido!" : "Sem novidades"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filter === "unread"
                  ? "Nenhuma notificação não lida no momento."
                  : "Quando algo acontecer, você verá aqui."}
              </p>
            </div>
          ) : (
            <div className="px-2 pb-2 pt-1">
              <AnimatePresence initial={false}>
                {grouped.map((group) => (
                  <div key={group.label} className="mb-1">
                    <div className="sticky top-0 z-10 bg-popover/95 px-2 py-1.5 backdrop-blur">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        {group.label}
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {group.items.map((n) => {
                        const link = getLink(n);
                        const unreadDot = !n.read_at;

                        const Inner = (
                          <motion.div
                            layout
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={cn(
                              "group relative flex gap-3 rounded-2xl p-2.5 transition-all",
                              unreadDot
                                ? "bg-primary/[0.06] hover:bg-primary/[0.10]"
                                : "hover:bg-secondary/60",
                            )}
                          >
                            {/* Barra lateral indicando não lida */}
                            {unreadDot && (
                              <span
                                className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                                aria-hidden
                              />
                            )}
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                                typeAccent[n.type],
                              )}
                            >
                              {typeIcon[n.type]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                  {typeLabel[n.type]}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60">
                                  · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                              <p className={cn(
                                "mt-0.5 truncate text-sm leading-tight",
                                unreadDot ? "font-bold text-foreground" : "font-medium text-foreground/85",
                              )}>
                                {n.title}
                              </p>
                              {n.body && (
                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {n.body}
                                </p>
                              )}
                            </div>
                            {unreadDot && (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleClick(n); }}
                                title="Marcar como lida"
                                className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-primary/15 hover:text-primary"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </motion.div>
                        );

                        return (
                          <li key={n.id}>
                            {link ? (
                              <Link
                                to={link}
                                onClick={() => { void handleClick(n); setOpen(false); }}
                                className="block"
                              >
                                {Inner}
                              </Link>
                            ) : (
                              <button
                                onClick={() => void handleClick(n)}
                                className="block w-full text-left"
                              >
                                {Inner}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
