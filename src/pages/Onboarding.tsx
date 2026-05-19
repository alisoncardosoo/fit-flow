import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Target, Flame, TrendingUp, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Goal = Database["public"]["Enums"]["fitness_goal"];
type Level = Database["public"]["Enums"]["fitness_level"];

const goals: { id: Goal; label: string; desc: string; icon: typeof Target }[] = [
  { id: "hypertrophy", label: "Hipertrofia", desc: "Ganhar massa muscular", icon: Dumbbell },
  { id: "weight_loss", label: "Emagrecimento", desc: "Perder gordura corporal", icon: Flame },
  { id: "strength", label: "Força", desc: "Levantar mais peso", icon: TrendingUp },
  { id: "conditioning", label: "Condicionamento", desc: "Melhorar resistência", icon: Target },
];

const levels: { id: Level; label: string; desc: string }[] = [
  { id: "beginner", label: "Iniciante", desc: "Menos de 6 meses treinando" },
  { id: "intermediate", label: "Intermediário", desc: "6 meses a 2 anos" },
  { id: "advanced", label: "Avançado", desc: "Mais de 2 anos" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [weeklyTarget, setWeeklyTarget] = useState(4);
  const [saving, setSaving] = useState(false);

  const next = () => setStep((s) => s + 1);

  const finish = async () => {
    if (!user || !goal || !level) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ goal, level, weekly_target: weeklyTarget, onboarded: true })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
      return;
    }

    // Keep dashboard cache in sync to avoid redirecting back to onboarding
    // with stale `onboarded = false` data right after completion.
    queryClient.setQueryData(["dashboard", user.id], (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev;

      const current = prev as {
        profile?: {
          onboarded?: boolean;
          goal?: Goal | null;
          level?: Level | null;
          weekly_target?: number | null;
        } | null;
      };

      return {
        ...current,
        profile: current.profile
          ? {
              ...current.profile,
              onboarded: true,
              goal,
              level,
              weekly_target: weeklyTarget,
            }
          : current.profile,
      };
    });
    await queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });

    toast.success("Pronto! Vamos treinar 🔥");
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10 safe-top">
        {/* Progress */}
        <div className="mb-8 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition ${
                i <= step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="goal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-1 flex-col"
            >
              <span className="pill mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Passo 1 de 3
              </span>
              <h2 className="font-display text-3xl font-bold">
                Qual seu objetivo<span className="text-primary">?</span>
              </h2>
              <p className="mt-2 text-muted-foreground">Vamos personalizar tudo pra você.</p>

              <div className="mt-8 space-y-3">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                      goal === g.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className={`rounded-xl p-3 ${goal === g.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                      <g.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{g.label}</div>
                      <div className="text-xs text-muted-foreground">{g.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={next}
                disabled={!goal}
                className="mt-auto h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Continuar <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="level"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-1 flex-col"
            >
              <span className="pill mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Passo 2 de 3
              </span>
              <h2 className="font-display text-3xl font-bold">
                Qual seu nível<span className="text-primary">?</span>
              </h2>
              <p className="mt-2 text-muted-foreground">Pra calibrar cargas e progressão.</p>

              <div className="mt-8 space-y-3">
                {levels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLevel(l.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-5 text-left transition ${
                      level === l.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{l.label}</div>
                      <div className="text-xs text-muted-foreground">{l.desc}</div>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 ${level === l.id ? "border-primary bg-primary" : "border-border"}`} />
                  </button>
                ))}
              </div>

              <Button
                onClick={next}
                disabled={!level}
                className="mt-auto h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Continuar <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="freq"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-1 flex-col"
            >
              <span className="pill mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Passo 3 de 3
              </span>
              <h2 className="font-display text-3xl font-bold">
                Sua meta semanal<span className="text-primary">.</span>
              </h2>
              <p className="mt-2 text-muted-foreground">Quantos treinos por semana?</p>

              <div className="mt-12 flex flex-col items-center">
                <div className="text-7xl font-display font-bold text-gradient">{weeklyTarget}</div>
                <div className="mt-2 text-sm text-muted-foreground">treinos / semana</div>
              </div>

              <div className="mt-8 grid grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setWeeklyTarget(n)}
                    className={`h-12 rounded-xl text-sm font-bold transition ${
                      weeklyTarget === n
                        ? "bg-primary text-primary-foreground glow-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <Button
                onClick={finish}
                disabled={saving}
                className="mt-auto h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary"
              >
                {saving ? "Salvando…" : "Começar a treinar 🔥"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
