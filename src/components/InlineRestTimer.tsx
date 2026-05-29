import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, Plus, Minus, RotateCcw, X, Timer } from "lucide-react";

interface Props {
  /** Duração de descanso do exercício atual, em segundos. */
  seconds: number;
}

type Phase = "idle" | "running" | "done";

function postToServiceWorker(message: Record<string, unknown>) {
  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (sw) sw.postMessage(message);
}

export function InlineRestTimer({ seconds }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const [running, setRunning] = useState(false);

  // Enquanto estiver em idle, acompanha a duração do exercício atual.
  useEffect(() => {
    if (phase === "idle") {
      setRemaining(seconds);
      setTotal(seconds);
    }
  }, [seconds, phase]);

  // Contagem regressiva — só roda quando iniciado manualmente e não pausado.
  useEffect(() => {
    if (phase !== "running" || !running) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) return 0;
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, running]);

  // Transição para "done" ao zerar: vibra, cancela o SW e volta para idle.
  useEffect(() => {
    if (phase !== "running" || remaining > 0) return;
    setPhase("done");
    setRunning(false);
    postToServiceWorker({ type: "cancel-rest-timer" });
    if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    const t = setTimeout(() => {
      setPhase("idle");
      setRemaining(seconds);
      setTotal(seconds);
    }, 2000);
    return () => clearTimeout(t);
  }, [phase, remaining, seconds]);

  const start = () => {
    const dur = seconds;
    setRemaining(dur);
    setTotal(dur);
    setPhase("running");
    setRunning(true);
    postToServiceWorker({ type: "schedule-rest-timer", endsAt: Date.now() + dur * 1000 });
  };

  const stop = () => {
    setPhase("idle");
    setRunning(false);
    setRemaining(seconds);
    setTotal(seconds);
    postToServiceWorker({ type: "cancel-rest-timer" });
  };

  const toggleRunning = () => {
    setRunning((r) => {
      const next = !r;
      if (next) {
        postToServiceWorker({ type: "schedule-rest-timer", endsAt: Date.now() + remaining * 1000 });
      } else {
        postToServiceWorker({ type: "cancel-rest-timer" });
      }
      return next;
    });
  };

  const adjust = (delta: number) => {
    setRemaining((r) => {
      const next = Math.max(0, r + delta);
      if (running && next > 0) {
        postToServiceWorker({ type: "schedule-rest-timer", endsAt: Date.now() + next * 1000 });
      }
      return next;
    });
    setTotal((t) => Math.max(t, remaining + delta));
  };

  const reset = () => {
    setRemaining(total);
    setRunning(true);
    setPhase("running");
    postToServiceWorker({ type: "schedule-rest-timer", endsAt: Date.now() + total * 1000 });
  };

  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  // --- IDLE: barra compacta com botão "Iniciar" ---
  if (phase === "idle") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-premium flex items-center gap-3 rounded-3xl p-3.5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Timer className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descanso</p>
          <p className="font-display text-lg font-bold tabular-nums">{mm}:{ss}</p>
        </div>
        <button
          onClick={start}
          className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground active:scale-95"
        >
          <Play className="h-4 w-4" />
          Iniciar
        </button>
      </motion.div>
    );
  }

  const isDone = phase === "done";

  // --- RUNNING / DONE: card com círculo e controles ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-premium relative overflow-hidden rounded-3xl p-5"
    >
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ opacity: isDone ? [0.3, 0.6, 0.3] : [0.15, 0.3, 0.15] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/40 blur-[80px]"
        />
      </div>

      <button
        onClick={stop}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
        aria-label="Fechar cronômetro"
      >
        <X className="h-4 w-4" />
      </button>

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
            {isDone ? "Pronto!" : "Descanso"}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">
            {isDone ? "Bora pra próxima 💪" : "Recupere a respiração"}
          </p>

          {!isDone && (
            <div className="mt-3 flex items-center gap-1.5">
              <button
                onClick={() => adjust(-15)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary active:scale-95"
                aria-label="-15 segundos"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={toggleRunning}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary active:scale-95"
                aria-label={running ? "Pausar" : "Continuar"}
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
