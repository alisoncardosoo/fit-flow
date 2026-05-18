import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Users, Trophy, Dumbbell, Sparkles, Check } from "lucide-react";
import type { NotificationType } from "@/lib/notifications";

type PushPayload = {
  title?: string;
  body?: string;
  type?: NotificationType | string;
  payload?: Record<string, unknown>;
  notification_id?: string | null;
  handle?: string | null;
};

const ICONS: Partial<Record<NotificationType, JSX.Element>> = {
  friend_request: <Users className="h-4 w-4" />,
  friend_accepted: <Check className="h-4 w-4" />,
  friend_workout: <Dumbbell className="h-4 w-4" />,
  reaction_received: <Heart className="h-4 w-4" />,
  challenge_invite: <Trophy className="h-4 w-4" />,
  challenge_overtaken: <Sparkles className="h-4 w-4" />,
  challenge_won: <Trophy className="h-4 w-4" />,
};

const ACCENTS: Partial<Record<NotificationType, string>> = {
  friend_request: "from-purple-500/30 to-purple-500/0 ring-purple-500/30 text-purple-200",
  friend_accepted: "from-emerald-500/30 to-emerald-500/0 ring-emerald-500/30 text-emerald-200",
  friend_workout: "from-primary/30 to-primary/0 ring-primary/30 text-primary",
  reaction_received: "from-pink-500/30 to-pink-500/0 ring-pink-500/30 text-pink-200",
  challenge_invite: "from-orange-500/30 to-orange-500/0 ring-orange-500/30 text-orange-200",
  challenge_overtaken: "from-red-500/30 to-red-500/0 ring-red-500/30 text-red-200",
  challenge_won: "from-yellow-500/30 to-yellow-500/0 ring-yellow-500/30 text-yellow-200",
};

function pickRoute(p: PushPayload): string {
  const payload = (p.payload ?? {}) as Record<string, string>;
  switch (p.type) {
    case "friend_request":
    case "friend_accepted":
      return "/social";
    case "friend_workout":
    case "reaction_received":
      return "/history";
    case "challenge_invite":
    case "challenge_overtaken":
    case "challenge_won":
      return payload.challenge_id ? `/challenges/${payload.challenge_id}` : "/challenges";
    default:
      return "/";
  }
}

/** Returns "@handle" if present anywhere in title/body, else null. */
function findHandle(p: PushPayload): string | null {
  if (p.handle) return p.handle;
  const src = `${p.title ?? ""} ${p.body ?? ""}`;
  const m = src.match(/@[a-z0-9_.]{3,30}/i);
  return m ? m[0] : null;
}

/**
 * Bridges Web Push events (forwarded from the service worker) and Supabase
 * realtime notifications into a premium in-app toast + a bell-badge bump.
 *
 * - Listens to `navigator.serviceWorker` "message" events of kind `push-received`.
 * - Falls back to Supabase realtime for users without push enabled.
 * - Shows a custom Sonner toast with avatar/icon, gradient and "Ver" CTA.
 * - Dispatches a global `flow:notif-bump` event so the bell can pulse.
 */
export function PushBridge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Dedup: avoid double-toast when both SW and realtime fire for the same row.
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    function rememberAndShow(p: PushPayload) {
      const id = p.notification_id ?? `${p.type}-${p.title}-${Date.now()}`;
      if (seenIds.current.has(id)) return;
      seenIds.current.add(id);
      // Keep set small
      if (seenIds.current.size > 50) {
        seenIds.current = new Set(Array.from(seenIds.current).slice(-25));
      }

      window.dispatchEvent(new CustomEvent("flow:notif-bump"));

      const handle = findHandle(p);
      const route = pickRoute(p);
      const type = (p.type ?? "") as NotificationType;
      const accent = ACCENTS[type] ?? "from-primary/30 to-primary/0 ring-primary/30 text-primary";
      const icon = ICONS[type] ?? <Sparkles className="h-4 w-4" />;

      // Strip the @handle from body when we surface it as a separate avatar/title chip.
      const cleanBody = handle
        ? (p.body ?? p.title ?? "").replace(handle, "").replace(/^\s+/, "").trim()
        : (p.body ?? "");

      toast.custom(
        (t) => (
          <button
            onClick={() => {
              toast.dismiss(t);
              navigate(route);
            }}
            className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-popover/95 p-3 text-left shadow-elevated backdrop-blur-xl transition active:scale-[0.99]"
            style={{ minWidth: 320 }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${accent.split(" ")[0]} ${accent.split(" ")[1]} opacity-60`}
              aria-hidden
            />
            <div className="relative flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/70 ring-1 ${accent.split(" ").slice(2, 4).join(" ")}`}
              >
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {handle ? (
                    <span className="truncate font-display text-sm font-extrabold text-foreground">
                      {handle}
                    </span>
                  ) : (
                    <span className="truncate font-display text-sm font-extrabold text-foreground">
                      {p.title}
                    </span>
                  )}
                  <span className="shrink-0 rounded-full bg-background/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Push
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {handle ? cleanBody || p.title : p.body}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Toque para abrir →
                </p>
              </div>
            </div>
          </button>
        ),
        { duration: 5000, position: "top-center" },
      );
    }

    // 1) Service worker → window messages
    const onSwMessage = (e: MessageEvent) => {
      const data = e.data as { kind?: string } & PushPayload;
      if (!data || data.kind !== "push-received") return;
      rememberAndShow(data);
    };
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    // 2) Realtime fallback (works when push not enabled / app focused on desktop)
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    if (user) {
      channelRef = supabase
        .channel(`push-bridge-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              type: NotificationType;
              title: string;
              body: string | null;
              payload: Record<string, unknown> | null;
            };
            // Only fire if the row was created in the last few seconds —
            // avoids firing on backfill subscriptions.
            rememberAndShow({
              notification_id: row.id,
              type: row.type,
              title: row.title,
              body: row.body ?? "",
              payload: row.payload ?? {},
            });
          },
        )
        .subscribe();
    }

    return () => {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
      if (channelRef) void supabase.removeChannel(channelRef);
    };
  }, [user, navigate]);

  return null;
}
