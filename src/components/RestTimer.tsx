import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, SkipForward } from "lucide-react";

interface Props {
  open: boolean;
  seconds: number;
  onClose: () => void;
}

export function RestTimer({ open, seconds, onClose }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const completedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setRemaining(seconds);
    setTotal(seconds);
    completedRef.current = false;
  }, [open, seconds]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const swContainer = navigator.serviceWorker;
    if (!swContainer) return;
    const msg = open
      ? { type: "schedule-rest-timer", endsAt: Date.now() + seconds * 1000 }
      : { type: "cancel-rest-timer" };
    // controller is null on first load in Safari before the SW claims the page.
    if (swContainer.controller) {
      swContainer.controller.postMessage(msg);
    } else {
      swContainer.ready.then((reg) => { reg.active?.postMessage(msg); }).catch(() => {});
    }
  }, [open, seconds]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
            setTimeout(() => onCloseRef.current(), 600);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open]);

  const adjust = (delta: number) => {
    setRemaining((r) => Math.max(0, r + delta));
    setTotal((t) => Math.max(t, remaining + delta));
  };

  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-2xl"
        >
          {/* Animated bg gradient */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[120px]"
            />
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-strong relative mx-6 w-full max-w-sm rounded-[2.5rem] p-8 shadow-elevated"
          >
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descanso</p>
              <h2 className="mt-1 font-display text-lg font-bold">Recupere a respiração</h2>
            </div>

            {/* Circular timer */}
            <div className="relative mx-auto mt-6 h-56 w-56">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="92" stroke="hsl(var(--secondary))" strokeWidth="8" fill="none" />
                <motion.circle
                  cx="100" cy="100" r="92"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 92}
                  animate={{ strokeDashoffset: 2 * Math.PI * 92 * (1 - pct / 100) }}
                  transition={{ duration: 0.5 }}
                  style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.6))" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-6xl font-bold tabular-nums text-foreground">{mm}:{ss}</div>
                <div className="mt-1 text-xs text-muted-foreground">restantes</div>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={() => adjust(-15)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Minus className="h-5 w-5" />
                <span className="sr-only">-15s</span>
              </button>
              <button onClick={onClose} className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground glow-primary">
                <SkipForward className="h-4 w-4" /> Pular
              </button>
              <button onClick={() => adjust(15)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Plus className="h-5 w-5" />
                <span className="sr-only">+15s</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
