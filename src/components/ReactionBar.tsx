import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  REACTION_EMOJI, toggleReaction, type ReactionEmoji,
} from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";

type ReactionRow = { emoji: ReactionEmoji; from_user_id: string };

const ORDER: ReactionEmoji[] = ["flex", "fire", "clap"];

export function ReactionBar({
  sessionId,
  initial = [],
  size = "md",
}: {
  sessionId: string;
  initial?: ReactionRow[];
  size?: "sm" | "md";
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReactionRow[]>(initial);
  const [busy, setBusy] = useState<ReactionEmoji | null>(null);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  // Live updates per session
  useEffect(() => {
    const ch = supabase
      .channel(`reactions-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase
            .from("reactions")
            .select("emoji, from_user_id")
            .eq("session_id", sessionId);
          setRows((data ?? []) as ReactionRow[]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [sessionId]);

  async function handle(e: ReactionEmoji) {
    if (!user || busy) return;
    setBusy(e);
    try {
      await toggleReaction(sessionId, user.id, e);
    } finally {
      setBusy(null);
    }
  }

  const counts = ORDER.map((e) => ({
    emoji: e,
    total: rows.filter((r) => r.emoji === e).length,
    mine: !!user && rows.some((r) => r.emoji === e && r.from_user_id === user.id),
  }));

  const padX = size === "sm" ? "px-2" : "px-2.5";
  const padY = size === "sm" ? "py-1" : "py-1.5";
  const text = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex flex-wrap gap-1.5">
      {counts.map(({ emoji, total, mine }) => (
        <motion.button
          key={emoji}
          whileTap={{ scale: 0.85 }}
          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); void handle(emoji); }}
          className={`inline-flex items-center gap-1 rounded-full ${padX} ${padY} ${text} font-semibold transition ${
            mine ? "bg-primary/20 text-primary ring-1 ring-primary/40" : "bg-secondary text-foreground/80 hover:bg-secondary/70"
          }`}
        >
          <span className="text-base leading-none">{REACTION_EMOJI[emoji]}</span>
          <AnimatePresence mode="popLayout">
            {total > 0 && (
              <motion.span
                key={total}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="tabular-nums"
              >
                {total}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      ))}
    </div>
  );
}
