import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, Plus, Minus, SkipForward, RotateCcw } from "lucide-react";

interface Props {
  seconds: number;
  title?: string;
  onSkip: () => void;
  onComplete?: () => void;
}

export function InlineRestTimer({ seconds, title = "Próximo exercício em", onSkip, onComplete }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const [running, setRunning] = useState(true);
  const completedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    setTotal(seconds);
    setRunning(true);
    completedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        onComplete?.();
      }
      return;
    }
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, running, onComplete]);

  const adjust = (delta: number) => {
    setRemaining((r) => Math.max(0, r + delta));
    setTotal((t) => Math.max(t, remaining + delta));
    if (remaining + delta > 0) completedRef.current = false;
  };

  const reset = () => {
    setRemaining(seconds);
    setTotal(seconds);
    setRunning(true);
    completedRef.current = false;
  };

  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const isDone = remaining <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="card-premium relative overflow-hidden rounded-3xl p-5"
    >
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ opacity: isDone ? [0.3, 0.6, 0.3] : [0.15, 0.3, 0.15] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/40 blur-[80px]"
        />
      </div>

      <div className="relative flex items-center gap-4">
        {/* Circular timer */}
        <div className="relative h-24 w-24 shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" stroke="hsl(var(--secondary))" strokeWidth="6" fill="none" />
            <motion.circle
              cx="50" cy="50" r="44"
              stroke="hsl(var(--primary))"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - pct / 100) }}
              transition={{ duration: 0.5 }}
              style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-display text-2xl font-bold tabular-nums">{mm}:{ss}</div>
          </div>
        </div>

        {/* Info + controls */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            {isDone ? "Pronto!" : "Pausa"}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">{title}</p>

          <div className="mt-3 flex items-center gap-1.5">
            <button
              onClick={() => adjust(-15)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary active:scale-95"
              aria-label="-15 segundos"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setRunning((r) => !r)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary active:scale-95"
              aria-label={running ? "Pausar" : "Continuar"}
            >
              {running && !isDone ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => adjust(15)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary active:scale-95"
              aria-label="+15 segundos"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={reset}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary active:scale-95"
              aria-label="Reiniciar"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={onSkip}
              className="ml-auto flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground active:scale-95"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pular
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
