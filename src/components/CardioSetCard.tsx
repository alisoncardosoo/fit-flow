import { motion } from "framer-motion";
import { Play, Pause, CheckCircle2 } from "lucide-react";

interface Props {
  intervalIndex: number;
  totalIntervals: number;
  targetDurationSec: number;
  targetIntensity: number;
  elapsed: number;
  running: boolean;
  onToggle: () => void;
  onComplete: () => void;
}

export function CardioSetCard({
  intervalIndex,
  totalIntervals,
  targetDurationSec,
  targetIntensity,
  elapsed,
  running,
  onToggle,
  onComplete,
}: Props) {
  const pct = targetDurationSec > 0 ? Math.min((elapsed / targetDurationSec) * 100, 100) : 0;
  const isDone = targetDurationSec > 0 && elapsed >= targetDurationSec;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const targetMin = Math.floor(targetDurationSec / 60);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
          Intervalo {intervalIndex + 1} de {totalIntervals}
        </div>
        <div className="text-xs text-muted-foreground">
          Alvo: {targetMin}min{targetIntensity > 0 ? ` · ${targetIntensity} km/h` : ""}
        </div>
      </div>

      <div className="relative mx-auto h-48 w-48">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="88" stroke="hsl(var(--secondary))" strokeWidth="8" fill="none" />
          <motion.circle
            cx="100"
            cy="100"
            r="88"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 88}
            animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - pct / 100) }}
            transition={{ duration: 0.5 }}
            style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.6))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-5xl font-bold tabular-nums">
            {mm}:{ss}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {isDone ? "Alvo atingido!" : running ? "em andamento" : "pausado"}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onToggle}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95"
          aria-label={running ? "Pausar" : "Iniciar"}
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={onComplete}
          className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground glow-primary active:scale-95"
        >
          <CheckCircle2 className="h-4 w-4" />
          Concluir
        </button>
      </div>
    </motion.div>
  );
}
