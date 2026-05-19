import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { X, Check, ChevronLeft, ChevronRight, SkipForward, Minus, Plus, Sparkles, ImagePlus, Copy, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { RestTimer } from "@/components/RestTimer";
import { CardioSetCard } from "@/components/CardioSetCard";
import { ExerciseImage } from "@/components/ExerciseImage";
import { ExerciseImagePicker } from "@/components/ExerciseImagePicker";
import { SheetPicker } from "@/components/SheetPicker";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badges";
import { startActiveSession, updateActiveSession, endActiveSession } from "@/lib/social";
import { listSheets, type RoutineSheet } from "@/lib/sheets";
import { prefetchExerciseImage, getUserOverride } from "@/lib/exerciseImageCache";

type Item = {
  id: string;
  exercise_id: string;
  sheet_id: string | null;
  target_sets: number;
  target_reps: number;
  target_weight: number;
  rest_seconds: number;
  exercises: { id: string; name: string; muscle_group: string; image_url: string | null };
};

type SetEntry = { reps: number; weight: number; done: boolean };

type WipState = {
  sessionId: string;
  startedAt: number;
  sheetId: string;
  currentEx: number;
  setsByItem: Record<string, SetEntry[]>;
};

export default function Execute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"loading" | "picking" | "running">("loading");
  const [sheets, setSheets] = useState<RoutineSheet[]>([]);
  const [exerciseCounts, setExerciseCounts] = useState<Record<string, number>>({});
  const [suggestedSheetId, setSuggestedSheetId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<RoutineSheet | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [workoutName, setWorkoutName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [currentEx, setCurrentEx] = useState(0);
  const [setsByItem, setSetsByItem] = useState<Record<string, SetEntry[]>>({});
  const [restOpen, setRestOpen] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  const [suggestedWeight, setSuggestedWeight] = useState<Record<string, number>>({});
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cardioElapsed, setCardioElapsed] = useState(0);
  const [cardioRunning, setCardioRunning] = useState(false);
  const cardioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick a cada 1s para o cronômetro do treino. Recalcula a partir de `startedAt`
  // (não acumula) — assim segue correto mesmo após o tab voltar do background.
  useEffect(() => {
    if (phase !== "running") return;
    const update = () => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const id = window.setInterval(update, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, startedAt]);

  function formatDuration(totalSec: number) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  /* ---------------- INIT: load sheets + decide picking vs auto ---------------- */
  useEffect(() => {
    if (id && user) void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function bootstrap() {
    if (!id || !user) return;
    const [{ data: w }, sheetList, { data: allEx }] = await Promise.all([
      supabase.from("workouts").select("name, last_sheet_id").eq("id", id).maybeSingle(),
      listSheets(id),
      supabase.from("workout_exercises").select("sheet_id").eq("workout_id", id),
    ]);
    if (!w) {
      toast.error("Treino não encontrado");
      navigate("/workouts");
      return;
    }
    setWorkoutName(w.name);

    // exercise count per sheet
    const counts: Record<string, number> = {};
    for (const e of allEx ?? []) if (e.sheet_id) counts[e.sheet_id] = (counts[e.sheet_id] ?? 0) + 1;
    setExerciseCounts(counts);
    setSheets(sheetList);

    const populated = sheetList.filter((s) => (counts[s.id] ?? 0) > 0);
    if (populated.length === 0) {
      toast.error("Treino vazio — adicione exercícios primeiro");
      navigate(`/workouts/${id}`);
      return;
    }

    // Suggest next: based on workouts.last_sheet_id → use NEXT in order
    let suggested: string | null = null;
    if (w.last_sheet_id) {
      const idx = populated.findIndex((s) => s.id === w.last_sheet_id);
      if (idx >= 0) suggested = populated[(idx + 1) % populated.length].id;
    }
    if (!suggested) suggested = populated[0].id;
    setSuggestedSheetId(suggested);

    // Restore an in-progress session if the user exited before finishing.
    const wipKey = `fitflow_wip_${user.id}_${id}`;
    const savedWip = localStorage.getItem(wipKey);
    if (savedWip) {
      try {
        const wip = JSON.parse(savedWip) as WipState;
        const { data: existingSession } = await supabase
          .from("workout_sessions")
          .select("id")
          .eq("id", wip.sessionId)
          .is("finished_at", null)
          .maybeSingle();
        if (existingSession) {
          await resumeSession(wip, sheetList, w.name);
          return;
        }
      } catch (_) {}
      localStorage.removeItem(wipKey);
    }

    // URL param override (e.g. ?sheet=...)
    const fromUrl = searchParams.get("sheet");
    const preselected = fromUrl && populated.some((s) => s.id === fromUrl) ? fromUrl : null;

    if (preselected) {
      await startSession(preselected, sheetList, w.name);
    } else if (populated.length === 1) {
      await startSession(populated[0].id, sheetList, w.name);
    } else {
      setPhase("picking");
    }
  }

  async function resumeSession(wip: WipState, sheetList: RoutineSheet[], wName: string) {
    if (!id || !user) return;
    const { data: we } = await supabase
      .from("workout_exercises")
      .select("*, exercises(id, name, muscle_group, image_url)")
      .eq("workout_id", id)
      .eq("sheet_id", wip.sheetId)
      .order("position");
    if (!we || we.length === 0) {
      localStorage.removeItem(`fitflow_wip_${user.id}_${id}`);
      toast.error("Não foi possível retomar o treino");
      navigate("/workouts");
      return;
    }
    const list = we as Item[];
    const sheet = sheetList.find((s) => s.id === wip.sheetId) ?? null;
    const sessionLabel = sheet ? `${wName} · Ficha ${sheet.name}` : wName;
    const safeEx = Math.min(wip.currentEx, list.length - 1);
    // Merge saved sets with current exercise list (handles exercises added/removed after save).
    const mergedSets: Record<string, SetEntry[]> = {};
    for (const it of list) {
      mergedSets[it.id] = wip.setsByItem[it.id] ?? Array.from({ length: it.target_sets }, () => ({
        reps: it.target_reps,
        weight: Number(it.target_weight ?? 0),
        done: false,
      }));
    }
    setActiveSheet(sheet);
    setItems(list);
    setWorkoutName(wName);
    setSessionId(wip.sessionId);
    setStartedAt(wip.startedAt);
    setCurrentEx(safeEx);
    setSetsByItem(mergedSets);
    void startActiveSession({
      user_id: user.id,
      session_id: wip.sessionId,
      workout_name: sessionLabel,
      total_exercises: list.length,
      current_exercise_name: list[safeEx]?.exercises.name ?? "",
    });
    setPhase("running");
    toast.info("Treino retomado de onde você parou 💪");
  }

  async function startSession(sheetId: string, sheetList: RoutineSheet[], wName: string) {
    if (!id || !user) return;
    const sheet = sheetList.find((s) => s.id === sheetId) ?? null;
    setActiveSheet(sheet);

    const { data: we } = await supabase
      .from("workout_exercises")
      .select("*, exercises(id, name, muscle_group, image_url)")
      .eq("workout_id", id)
      .eq("sheet_id", sheetId)
      .order("position");
    if (!we || we.length === 0) {
      toast.error("Ficha vazia");
      setPhase("picking");
      return;
    }
    const list = we as Item[];
    setItems(list);

    // Init sets + weight suggestions.
    // Regra: o `target_weight` configurado pelo usuário é a fonte de verdade.
    // Apenas SUGERIMOS uma progressão (+2.5kg) quando o último log igualou
    // ou superou o alvo configurado E o usuário bateu as reps planejadas.
    // Caso contrário, mantemos exatamente o que o usuário definiu na ficha.
    const init: Record<string, SetEntry[]> = {};
    const sugg: Record<string, number> = {};
    for (const it of list) {
      const targetWeight = Number(it.target_weight ?? 0);
      init[it.id] = Array.from({ length: it.target_sets }, () => ({
        reps: it.target_reps,
        weight: targetWeight,
        done: false,
      }));

      // Skip progression suggestion for cardio exercises.
      if (it.exercises.muscle_group === "cardio") continue;

      const { data: lastSet } = await supabase
        .from("set_logs")
        .select("weight, reps")
        .eq("user_id", user.id)
        .eq("exercise_id", it.exercise_id)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastWeight = lastSet ? Number(lastSet.weight) : 0;
      const hitTargetReps = !!lastSet && lastSet.reps >= it.target_reps;
      const matchedTarget = lastWeight >= targetWeight && targetWeight > 0;

      const suggestedWeight =
        hitTargetReps && matchedTarget
          ? Math.round((lastWeight + 2.5) * 2) / 2
          : null;

      if (suggestedWeight !== null) sugg[it.id] = suggestedWeight;
    }
    setSetsByItem(init);
    setSuggestedWeight(sugg);

    const sessionLabel = sheet ? `${wName} · Ficha ${sheet.name}` : wName;
    const { data: session } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_id: id,
        sheet_id: sheetId,
        workout_name: sessionLabel,
      })
      .select()
      .single();
    if (session) {
      setSessionId(session.id);
      void startActiveSession({
        user_id: user.id,
        session_id: session.id,
        workout_name: sessionLabel,
        total_exercises: list.length,
        current_exercise_name: list[0]?.exercises.name ?? "",
      });
      const wip: WipState = { sessionId: session.id, startedAt, sheetId, currentEx: 0, setsByItem: init };
      localStorage.setItem(`fitflow_wip_${user.id}_${id}`, JSON.stringify(wip));
    }
    setPhase("running");
  }

  const current = items[currentEx];
  const total = items.length;
  const progress = useMemo(() => {
    if (!total) return 0;
    let done = 0;
    let totalSets = 0;
    for (const it of items) {
      const s = setsByItem[it.id] ?? [];
      done += s.filter((e) => e.done).length;
      totalSets += s.length;
    }
    return totalSets ? (done / totalSets) * 100 : 0;
  }, [setsByItem, items, total]);

  const handlers = useSwipeable({
    onSwipedLeft: () => goNext(),
    onSwipedRight: () => goPrev(),
    trackMouse: true,
    preventScrollOnSwipe: true,
    delta: 50,
  });

  function goNext() {
    setCurrentEx((c) => {
      const next = Math.min(c + 1, total - 1);
      const nextItem = items[next];
      if (user && nextItem) void updateActiveSession(user.id, next, nextItem.exercises.name);
      return next;
    });
  }
  function goPrev() {
    setCurrentEx((c) => {
      const prev = Math.max(c - 1, 0);
      const prevItem = items[prev];
      if (user && prevItem) void updateActiveSession(user.id, prev, prevItem.exercises.name);
      return prev;
    });
  }

  useEffect(() => {
    return () => {
      if (user) void endActiveSession(user.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset cardio timer whenever the active exercise changes.
  useEffect(() => {
    setCardioElapsed(0);
    setCardioRunning(false);
  }, [currentEx]);

  // Manage the cardio count-up interval.
  useEffect(() => {
    if (cardioTimerRef.current) {
      clearInterval(cardioTimerRef.current);
      cardioTimerRef.current = null;
    }
    if (!cardioRunning) return;
    cardioTimerRef.current = setInterval(() => setCardioElapsed((e) => e + 1), 1000);
    return () => {
      if (cardioTimerRef.current) clearInterval(cardioTimerRef.current);
    };
  }, [cardioRunning]);

  // Auto-stop and vibrate when target duration is reached.
  useEffect(() => {
    const targetSec = current?.exercises.muscle_group === "cardio" ? (current.target_reps * 60) : 0;
    if (!cardioRunning || targetSec <= 0 || cardioElapsed < targetSec) return;
    setCardioRunning(false);
    if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
  }, [cardioElapsed, cardioRunning, current]);

  // Keep localStorage in sync so progress survives unexpected exits.
  useEffect(() => {
    if (phase !== "running" || !sessionId || !user || !id) return;
    const wipKey = `fitflow_wip_${user.id}_${id}`;
    const saved = localStorage.getItem(wipKey);
    if (!saved) return;
    try {
      const wip = JSON.parse(saved) as WipState;
      localStorage.setItem(wipKey, JSON.stringify({ ...wip, currentEx, setsByItem }));
    } catch (_) {}
  }, [currentEx, setsByItem, phase, sessionId, user, id]);

  // Prefetch dos próximos 2 exercícios para troca de cards instantânea.
  useEffect(() => {
    if (!items.length) return;
    for (const offset of [1, 2]) {
      const next = items[currentEx + offset];
      if (!next) continue;
      void prefetchExerciseImage({
        exerciseId: next.exercise_id,
        name: next.exercises.name,
        existingUrl: next.exercises.image_url,
      });
    }
    // Também aquece o atual (cobre o caso de ?sheet=... ou retorno via swipe).
    const cur = items[currentEx];
    if (cur) {
      void prefetchExerciseImage({
        exerciseId: cur.exercise_id,
        name: cur.exercises.name,
        existingUrl: cur.exercises.image_url,
      });
    }
  }, [items, currentEx]);

  async function completeSet(setIdx: number) {
    if (!current) return;
    const itemId = current.id;
    const exerciseId = current.exercise_id;
    const restSec = current.rest_seconds;

    // Lê o state diretamente — evita depender de side-effects dentro do updater,
    // que não é confiável no React 18 concurrent mode.
    const prevSets = setsByItem[itemId] ?? [];
    const e = prevSets[setIdx];
    if (!e || e.done) return; // Já estava marcado.

    const entry: SetEntry = { ...e, done: true };
    const newSets = prevSets.map((s, i) => (i === setIdx ? entry : s));
    const allDoneAfter = newSets.every((s) => s.done);

    setSetsByItem((cur) => {
      const sets = cur[itemId] ?? [];
      if (sets[setIdx]?.done) return cur; // guard contra toque duplo rápido
      return { ...cur, [itemId]: newSets };
    });

    const hasNext = currentEx < total - 1;
    const shouldOpenRest = !(allDoneAfter && !hasNext);
    if (shouldOpenRest) {
      setRestSeconds(restSec);
      setRestOpen(true);
    }

    if ("vibrate" in navigator) navigator.vibrate(50);

    if (!sessionId || !user) {
      toast.error("Série marcada, mas não foi possível sincronizar o treino agora.");
      return;
    }

    const { error } = await supabase.from("set_logs").insert({
      session_id: sessionId,
      user_id: user.id,
      exercise_id: exerciseId,
      set_number: setIdx + 1,
      reps: entry.reps,
      weight: entry.weight,
      rest_seconds: restSec,
    });

    if (error) {
      // Reverte o "feito" caso o INSERT falhe — assim o usuário sabe que precisa
      // tentar de novo (em vez de o card mentir que salvou).
      setSetsByItem((cur) => {
        const sets = [...(cur[itemId] ?? [])];
        if (sets[setIdx]) sets[setIdx] = { ...sets[setIdx], done: false };
        return { ...cur, [itemId]: sets };
      });
      toast.error("Não foi possível salvar a série. Toque novamente.");
    }
  }

  async function completeCardioSet() {
    if (!current) return;
    const itemId = current.id;
    const exerciseId = current.exercise_id;
    const restSec = current.rest_seconds;

    const prevSets = setsByItem[itemId] ?? [];
    const setIdx = prevSets.findIndex((s) => !s.done);
    if (setIdx < 0) return;

    const elapsed = cardioElapsed;
    setCardioElapsed(0);
    setCardioRunning(false);

    const entry: SetEntry = { ...prevSets[setIdx], reps: elapsed, done: true };
    const newSets = prevSets.map((s, i) => (i === setIdx ? entry : s));
    const allDoneAfter = newSets.every((s) => s.done);

    setSetsByItem((cur) => ({ ...cur, [itemId]: newSets }));

    const hasNextEx = currentEx < total - 1;
    const shouldOpenRest = !(allDoneAfter && !hasNextEx);
    if (shouldOpenRest) {
      setRestSeconds(restSec);
      setRestOpen(true);
    }

    if ("vibrate" in navigator) navigator.vibrate(50);

    if (!sessionId || !user) {
      toast.error("Intervalo marcado, mas não foi possível sincronizar o treino agora.");
      return;
    }

    const { error } = await supabase.from("set_logs").insert({
      session_id: sessionId,
      user_id: user.id,
      exercise_id: exerciseId,
      set_number: setIdx + 1,
      reps: elapsed,
      weight: current.target_weight,
      rest_seconds: restSec,
    });

    if (error) {
      setSetsByItem((cur) => {
        const sets = [...(cur[itemId] ?? [])];
        if (sets[setIdx]) sets[setIdx] = { ...sets[setIdx], done: false };
        return { ...cur, [itemId]: sets };
      });
      toast.error("Não foi possível salvar o intervalo. Toque novamente.");
    }
  }

  function adjustWeight(setIdx: number, delta: number) {
    if (!current) return;
    const itemId = current.id;
    setSetsByItem((cur) => {
      const sets = [...(cur[itemId] ?? [])];
      const s = sets[setIdx];
      if (!s || s.done) return cur;
      sets[setIdx] = {
        ...s,
        weight: Math.max(0, Math.round((s.weight + delta) * 2) / 2),
      };
      return { ...cur, [itemId]: sets };
    });
  }

  function adjustReps(setIdx: number, delta: number) {
    if (!current) return;
    const itemId = current.id;
    setSetsByItem((cur) => {
      const sets = [...(cur[itemId] ?? [])];
      const s = sets[setIdx];
      if (!s || s.done) return cur;
      sets[setIdx] = { ...s, reps: Math.max(0, s.reps + delta) };
      return { ...cur, [itemId]: sets };
    });
  }

  async function addSet() {
    if (!current) return;
    const itemId = current.id;
    const prevSets = setsByItem[itemId] ?? [];
    const lastSet = prevSets[prevSets.length - 1];

    const newSet: SetEntry = {
      reps: lastSet?.reps ?? current.target_reps,
      weight: lastSet?.weight ?? current.target_weight,
      done: false,
    };

    const newTargetSets = prevSets.length + 1;

    setSetsByItem((cur) => ({ ...cur, [itemId]: [...(cur[itemId] ?? []), newSet] }));
    setItems((cur) => cur.map((it) => (it.id === itemId ? { ...it, target_sets: newTargetSets } : it)));

    if ("vibrate" in navigator) navigator.vibrate(30);

    await supabase
      .from("workout_exercises")
      .update({ target_sets: newTargetSets })
      .eq("id", itemId);
  }

  function copyToRemaining(setIdx: number) {
    if (!current) return;
    const itemId = current.id;
    let applied = 0;
    setSetsByItem((cur) => {
      const sets = [...(cur[itemId] ?? [])];
      const source = sets[setIdx];
      if (!source) return cur;
      for (let i = setIdx + 1; i < sets.length; i++) {
        if (sets[i].done) continue;
        sets[i] = { ...sets[i], reps: source.reps, weight: source.weight };
        applied++;
      }
      return { ...cur, [itemId]: sets };
    });
    if (applied > 0) {
      toast.success(
        `Copiado para ${applied} série${applied > 1 ? "s" : ""} restante${applied > 1 ? "s" : ""}`,
      );
      if ("vibrate" in navigator) navigator.vibrate(30);
    } else {
      toast.info("Nenhuma série pendente para copiar");
    }
  }

  async function finish() {
    if (!sessionId || !user) return navigate("/");
    if (id) localStorage.removeItem(`fitflow_wip_${user.id}_${id}`);
    const totalVolume = Object.values(setsByItem).flat().filter((s) => s.done).reduce((a, s) => a + s.reps * s.weight, 0);
    const duration = Math.round((Date.now() - startedAt) / 1000);
    await supabase
      .from("workout_sessions")
      .update({
        finished_at: new Date().toISOString(),
        duration_seconds: duration,
        total_volume: totalVolume,
      })
      .eq("id", sessionId);
    void endActiveSession(user.id);
    toast.success("Treino concluído! 💪", {
      description: `Duração: ${formatDuration(duration)} · Volume: ${Math.round(totalVolume)}kg`,
    });

    try {
      const newBadges = await checkAndAwardBadges(user.id);
      for (const b of newBadges) {
        toast.success(`🏆 Medalha desbloqueada: ${b.title}`, { description: b.description, duration: 5000 });
      }
    } catch (e) {
      console.error("Badge check failed", e);
    }
    navigate("/");
  }

  /* ---------------- RENDER ---------------- */
  if (phase === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando treino…</div>;
  }

  if (phase === "picking") {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center px-5 text-center text-muted-foreground">
          <div>
            <div className="mb-3 font-display text-lg font-bold text-foreground">{workoutName}</div>
            <p className="text-sm">Selecione a ficha do dia</p>
          </div>
        </div>
        <SheetPicker
          open
          onClose={() => navigate(`/workouts/${id}`)}
          sheets={sheets}
          suggestedId={suggestedSheetId}
          exerciseCounts={exerciseCounts}
          onPick={(sid) => void startSession(sid, sheets, workoutName)}
        />
      </>
    );
  }

  if (!current) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const sets = setsByItem[current.id] ?? [];
  const isCardio = current.exercises.muscle_group === "cardio";
  const currentCardioInterval = isCardio ? sets.findIndex((s) => !s.done) : -1;
  const hasSuggestion = !isCardio && suggestedWeight[current.id] != null && sets.some((s) => !s.done);
  const allSetsDone = sets.length > 0 && sets.every((s) => s.done);
  const hasNext = currentEx < total - 1;

  return (
    <div className="relative min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-30 bg-background/80 px-5 pb-3 backdrop-blur safe-top">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="rounded-xl bg-secondary p-2"><X className="h-5 w-5" /></button>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              {currentEx + 1} de {total}
              {activeSheet && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Ficha {activeSheet.name}</span>}
            </div>
            <div className="font-display text-sm font-bold">{workoutName}</div>
            <div
              className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-primary"
              aria-label="Tempo decorrido do treino"
            >
              <Timer className="h-3 w-3" />
              {formatDuration(elapsedSec)}
            </div>
          </div>
          <Button onClick={finish} size="sm" className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            Finalizar
          </Button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <div {...handlers} className="px-5 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="card-premium overflow-hidden rounded-3xl"
          >
            <div className="relative">
              <ExerciseImage
                exerciseId={current.exercise_id}
                name={current.exercises.name}
                muscleGroup={current.exercises.muscle_group}
                imageUrl={current.exercises.image_url}
                onResolved={(url) => {
                  setItems((cur) =>
                    cur.map((it) =>
                      it.id === current.id ? { ...it, exercises: { ...it.exercises, image_url: url } } : it,
                    ),
                  );
                }}
                className="aspect-[16/10] w-full"
                rounded="rounded-none"
                fallbackSize="lg"
              />
              <button
                onClick={() => setImagePickerOpen(true)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-2 text-xs font-semibold backdrop-blur-md shadow-lg transition hover:bg-background"
                title="Trocar imagem"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Trocar imagem
              </button>
            </div>
            <div className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">{current.exercises.muscle_group}</div>
              <h2 className="mt-1 font-display text-2xl font-bold">{current.exercises.name}</h2>

              {hasSuggestion && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1">Sugestão: <strong>{suggestedWeight[current.id]}kg</strong> com base no seu histórico</span>
                  <button
                    onClick={() => {
                      const itemId = current.id;
                      const w = suggestedWeight[itemId];
                      setSetsByItem((cur) => {
                        const s = cur[itemId] ?? [];
                        return { ...cur, [itemId]: s.map((e) => (e.done ? e : { ...e, weight: w })) };
                      });
                    }}
                    className="rounded-lg bg-primary px-2.5 py-1 font-bold text-primary-foreground"
                  >
                    Aplicar
                  </button>
                </div>
              )}

              {isCardio ? (
                <>
                  {sets.some((s) => s.done) && (
                    <div className="mt-5 space-y-1.5">
                      {sets.map((s, i) =>
                        s.done ? (
                          <div key={i} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold">
                            <Check className="h-3.5 w-3.5 text-primary" />
                            Intervalo {i + 1} — {String(Math.floor(s.reps / 60)).padStart(2, "0")}:{String(s.reps % 60).padStart(2, "0")}
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
                  {currentCardioInterval >= 0 && (
                    <CardioSetCard
                      intervalIndex={currentCardioInterval}
                      totalIntervals={sets.length}
                      targetDurationSec={current.target_reps * 60}
                      targetIntensity={current.target_weight}
                      elapsed={cardioElapsed}
                      running={cardioRunning}
                      onToggle={() => setCardioRunning((r) => !r)}
                      onComplete={() => void completeCardioSet()}
                    />
                  )}
                  <button
                    onClick={() => void addSet()}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/40 py-2.5 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/10 active:scale-[0.98]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar intervalo
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-5 space-y-2">
                    {sets.map((s, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded-2xl p-3 transition ${s.done ? "bg-primary/15 border border-primary/30" : "bg-secondary border border-transparent"}`}>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                          {i + 1}
                        </div>
                        <div className="flex flex-1 items-center gap-1">
                          <button onClick={() => adjustWeight(i, -2.5)} disabled={s.done} className="rounded-lg p-1 text-muted-foreground disabled:opacity-30"><Minus className="h-3 w-3" /></button>
                          <div className="flex-1 text-center">
                            <div className="text-base font-bold">{s.weight}</div>
                            <div className="text-[9px] text-muted-foreground">kg</div>
                          </div>
                          <button onClick={() => adjustWeight(i, 2.5)} disabled={s.done} className="rounded-lg p-1 text-muted-foreground disabled:opacity-30"><Plus className="h-3 w-3" /></button>
                        </div>
                        <div className="flex flex-1 items-center gap-1">
                          <button onClick={() => adjustReps(i, -1)} disabled={s.done} className="rounded-lg p-1 text-muted-foreground disabled:opacity-30"><Minus className="h-3 w-3" /></button>
                          <div className="flex-1 text-center">
                            <div className="text-base font-bold">{s.reps}</div>
                            <div className="text-[9px] text-muted-foreground">reps</div>
                          </div>
                          <button onClick={() => adjustReps(i, 1)} disabled={s.done} className="rounded-lg p-1 text-muted-foreground disabled:opacity-30"><Plus className="h-3 w-3" /></button>
                        </div>
                        <button
                          onClick={() => copyToRemaining(i)}
                          disabled={i >= sets.length - 1 || sets.slice(i + 1).every((x) => x.done)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition hover:bg-primary/15 hover:text-primary disabled:opacity-30"
                          title="Copiar reps e carga para as séries seguintes"
                          aria-label="Copiar para as séries seguintes"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => completeSet(i)}
                          disabled={s.done}
                          className={`flex h-10 w-10 items-center justify-center rounded-full transition ${s.done ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"}`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => void addSet()}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/40 py-2.5 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/10 active:scale-[0.98]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar série
                  </button>
                </>
              )}

              <div className="mt-5 flex justify-between text-xs text-muted-foreground">
                <span>Pausa: {current.rest_seconds}s</span>
                <button onClick={() => goNext()} className="flex items-center gap-1 font-semibold text-primary">
                  Pular <SkipForward className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-between">
          <button onClick={goPrev} disabled={currentEx === 0} className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentEx ? "w-6 bg-primary" : "w-1.5 bg-secondary"}`} />
            ))}
          </div>
          <button onClick={goNext} disabled={currentEx === total - 1} className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">Deslize ← → para trocar de exercício</p>
      </div>

      <RestTimer open={restOpen} seconds={restSeconds} onClose={() => setRestOpen(false)} />

      {current && (
        <ExerciseImagePicker
          open={imagePickerOpen}
          onOpenChange={setImagePickerOpen}
          exerciseId={current.exercise_id}
          exerciseName={current.exercises.name}
          hasDefaultImage={!!(current.exercises.image_url || getUserOverride(current.exercise_id))}
          onChanged={(newUrl) => {
            setItems((cur) =>
              cur.map((it) =>
                it.exercise_id === current.exercise_id
                  ? { ...it, exercises: { ...it.exercises, image_url: newUrl ?? it.exercises.image_url } }
                  : it,
              ),
            );
          }}
        />
      )}
    </div>
  );
}
