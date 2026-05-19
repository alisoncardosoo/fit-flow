import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LogOut, Target, Flame, Trophy, Heart, ChevronRight } from "lucide-react";
import nosLogo from "@/assets/nos-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchProfileData,
  updateProfile,
  type ProfileGoal,
  type ProfileLevel,
} from "@/services/profile.service";
import {
  isUsernameAvailable,
  setUsername as saveUsername,
  validateUsernameFormat,
} from "@/lib/username";
import { PushToggle } from "@/components/PushToggle";

type Goal = ProfileGoal;
type Level = ProfileLevel;

const goalLabels: Record<Goal, string> = {
  hypertrophy: "Hipertrofia", weight_loss: "Emagrecimento", strength: "Força", conditioning: "Condicionamento", endurance: "Resistência",
};

const levelLabels: Record<Level, string> = {
  beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado",
};

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [username, setUsernameState] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [level, setLevel] = useState<Level>("beginner");
  const [weeklyTarget, setWeeklyTarget] = useState(4);
  const [defaultSets, setDefaultSets] = useState(3);
  const [defaultReps, setDefaultReps] = useState(10);
  const [defaultRest, setDefaultRest] = useState(60);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["profile-page", user?.id],
    queryFn: () => fetchProfileData(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });

  const streak = data?.streak ?? 0;
  const totalSessions = data?.totalSessions ?? 0;

  // Hydrate local form state when data arrives
  useEffect(() => {
    const prof = data?.profile;
    if (!prof) return;
    setName(prof.display_name ?? "");
    setUsernameState(prof.username ?? "");
    setOriginalUsername(prof.username ?? "");
    setGoal(prof.goal ?? "hypertrophy");
    setLevel(prof.level ?? "beginner");
    setWeeklyTarget(prof.weekly_target ?? 4);
    setDefaultSets(prof.default_sets ?? 3);
    setDefaultReps(prof.default_reps ?? 10);
    setDefaultRest(prof.default_rest_seconds ?? 60);
  }, [data]);

  useEffect(() => {
    async function loadApiKeyState() {
      if (!user) return;
      const { data: row, error } = await supabase
        .from("user_api_keys")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Não foi possível carregar o status da chave de IA.");
        return;
      }
      setHasApiKey(!!row);
    }
    loadApiKeyState();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Username changed → validate + check availability separately to give clear errors.
      if (username !== originalUsername) {
        const v = validateUsernameFormat(username);
        if (!v.ok) {
          toast.error(v.reason);
          setSaving(false);
          return;
        }
        const available = await isUsernameAvailable(v.value);
        if (!available) {
          toast.error("Esse @ já está em uso");
          setSaving(false);
          return;
        }
        await saveUsername(user.id, v.value);
        setOriginalUsername(v.value);
        setUsernameState(v.value);
      }

      await updateProfile(user.id, {
        display_name: name,
        goal,
        level,
        weekly_target: weeklyTarget,
        default_sets: defaultSets,
        default_reps: defaultReps,
        default_rest_seconds: defaultRest,
      });

      const normalizedApiKey = apiKey.trim();
      if (normalizedApiKey.length > 0) {
        const { error: keyErr } = await supabase.from("user_api_keys").upsert(
          { user_id: user.id, api_key: normalizedApiKey },
          { onConflict: "user_id" },
        );
        if (keyErr) throw keyErr;
        setHasApiKey(true);
        setApiKey("");
      }

      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["profile-page", user.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] });
      queryClient.invalidateQueries({ queryKey: ["has-username", user.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow="Sua conta"
        title="Perfil"
        actions={
          <button
            onClick={signOut}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-destructive transition hover:bg-destructive/15"
            title="Sair"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        }
      />

      {loading ? (
        <Skeleton className="h-96 w-full rounded-3xl" />
      ) : (
        <>
          {/* Hero profile card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-hero mb-5 rounded-[28px] p-6"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-4xl font-extrabold text-primary-foreground shadow-glow">
                {(name || username || user?.email || "?").charAt(0).toUpperCase()}
              </div>
              <h2 className="mt-4 font-display text-[26px] font-extrabold tracking-tight">{name || "Atleta"}</h2>
              {originalUsername && (
                <p className="mt-0.5 text-sm font-bold text-primary">@{originalUsername}</p>
              )}
              <p className="text-xs text-foreground/60">{user?.email}</p>

              <div className="mt-5 grid w-full grid-cols-3 gap-2">
                <HeroStat icon={<Flame className="h-3.5 w-3.5" />} value={streak} label="Streak" />
                <HeroStat icon={<Trophy className="h-3.5 w-3.5" />} value={totalSessions} label="Treinos" />
                <HeroStat icon={<Target className="h-3.5 w-3.5" />} value={`${weeklyTarget}/sem`} label="Meta" />
              </div>
            </div>
          </motion.div>

          {/* Settings */}
          <div className="card-premium space-y-4 rounded-[24px] p-5">
            <h3 className="font-display text-base font-bold tracking-tight">Configurações</h3>
            <PushToggle />
            <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
              <h4 className="font-display text-sm font-bold tracking-tight">Chave de API (IA)</h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Use sua própria chave para recursos de IA. Ela fica vinculada à sua conta.
              </p>
              <div className="mt-3 space-y-2">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasApiKey ? "Já configurada. Cole para atualizar." : "Cole sua chave de API"}
                  className="h-12 rounded-2xl border-border bg-secondary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Status: {hasApiKey ? "configurada" : "não configurada"}
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-2xl border-border bg-secondary" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nome de usuário
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                  @
                </span>
                <Input
                  value={username}
                  onChange={(e) => setUsernameState(e.target.value.toLowerCase())}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={20}
                  placeholder="seu_handle"
                  className="h-12 rounded-2xl border-border bg-secondary pl-9 font-semibold tracking-wide"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Aparece no ranking, lista de amigos e nos cards compartilhados.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Objetivo</label>
              <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="h-12 w-full rounded-2xl border border-border bg-secondary px-4 text-sm font-medium">
                {(Object.keys(goalLabels) as Goal[]).map((g) => <option key={g} value={g}>{goalLabels[g]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Nível</label>
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className="h-12 w-full rounded-2xl border border-border bg-secondary px-4 text-sm font-medium">
                {(Object.keys(levelLabels) as Level[]).map((l) => <option key={l} value={l}>{levelLabels[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta semanal</label>
              <div className="grid grid-cols-7 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setWeeklyTarget(n)}
                    className={`h-11 rounded-xl text-sm font-extrabold transition ${
                      weeklyTarget === n
                        ? "bg-primary text-primary-foreground shadow-glow scale-105"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Defaults para novos exercícios */}
            <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
              <h4 className="font-display text-sm font-bold tracking-tight">Padrões de novos exercícios</h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Usados ao adicionar exercícios em treinos novos.</p>

              <div className="mt-3 space-y-3">
                <NumberRow
                  label="Séries padrão"
                  value={defaultSets}
                  onChange={setDefaultSets}
                  min={1}
                  max={10}
                  step={1}
                />
                <NumberRow
                  label="Repetições padrão"
                  value={defaultReps}
                  onChange={setDefaultReps}
                  min={1}
                  max={50}
                  step={1}
                />
                <NumberRow
                  label="Descanso padrão"
                  value={defaultRest}
                  onChange={setDefaultRest}
                  min={15}
                  max={300}
                  step={15}
                  suffix="s"
                />
              </div>
            </div>

            <Button
              onClick={save}
              disabled={saving}
              className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 shadow-glow disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>

          {/* Apoie o Dev — atalho */}
          <Link
            to="/support"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 transition hover:bg-card/70 active:scale-[0.99]"
          >
            <div className="flex h-11 w-16 items-center justify-center rounded-xl bg-background/60">
              <img
                src={nosLogo}
                alt="Nós Code"
                width={1080}
                height={361}
                className="h-5 w-auto"
                style={{ aspectRatio: "1080 / 361" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-bold tracking-tight flex items-center gap-1.5">
                Apoie o Dev <Heart className="h-3.5 w-3.5 text-primary" />
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Siga @nos.code no Instagram
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </>
      )}
    </div>
  );
}

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/30 p-3 backdrop-blur-md">
      <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 text-primary">{icon}</div>
      <div className="font-display text-base font-extrabold">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-foreground/60">{label}</div>
    </div>
  );
}

function NumberRow({
  label, value, onChange, min, max, step, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-base font-bold text-foreground transition active:scale-95"
          aria-label={`Diminuir ${label}`}
        >
          −
        </button>
        <div className="min-w-[64px] rounded-xl bg-background/40 px-3 py-1.5 text-center font-display text-base font-extrabold tabular-nums">
          {value}{suffix ?? ""}
        </div>
        <button
          type="button"
          onClick={inc}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-glow transition active:scale-95"
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
