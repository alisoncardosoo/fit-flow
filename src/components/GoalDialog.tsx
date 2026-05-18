import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLatestMeasurement } from "@/services/measurements.service";
import { toast } from "sonner";
import type { GoalType, GoalWithProgress } from "@/hooks/useGoalProgress";
import { Sparkles } from "lucide-react";

type Exercise = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  goal?: GoalWithProgress | null;
}

const types: { value: GoalType; label: string; unit: string; hint: string }[] = [
  { value: "bodyweight", label: "Peso corporal", unit: "kg", hint: "Acompanhe seu peso" },
  { value: "exercise_load", label: "Carga em exercício", unit: "kg", hint: "Atinja um PR" },
  { value: "weekly_frequency", label: "Frequência semanal", unit: "treinos", hint: "Treinos por semana" },
  { value: "monthly_frequency", label: "Frequência mensal", unit: "treinos", hint: "Treinos no mês" },
  { value: "custom", label: "Personalizada", unit: "un", hint: "Sua meta livre" },
];

type Template = {
  key: string;
  emoji: string;
  label: string;
  type: GoalType;
  title: string;
  unit: string;
  /** Para bodyweight: delta vs peso atual (negativo = perder). Demais: target absoluto. */
  target: number;
  daysAhead?: number;
};

const TEMPLATES: Template[] = [
  { key: "freq4", emoji: "🔥", label: "Treinar 4x/semana", type: "weekly_frequency", title: "Treinar 4x na semana", unit: "treinos", target: 4 },
  { key: "freq16", emoji: "📅", label: "16 treinos no mês", type: "monthly_frequency", title: "16 treinos este mês", unit: "treinos", target: 16 },
  { key: "pr", emoji: "💪", label: "Bater PR no supino", type: "exercise_load", title: "Bater PR no supino", unit: "kg", target: 100 },
  { key: "lose", emoji: "⚖️", label: "Perder 5kg em 60d", type: "bodyweight", title: "Perder 5kg", unit: "kg", target: -5, daysAhead: 60 },
];

export function GoalDialog({ open, onOpenChange, onSaved, goal }: Props) {
  const { user } = useAuth();
  const [type, setType] = useState<GoalType>("exercise_load");
  const [title, setTitle] = useState("");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [startValue, setStartValue] = useState<string>("0");
  const [targetValue, setTargetValue] = useState<string>("");
  const [unit, setUnit] = useState("kg");
  const [deadline, setDeadline] = useState<string>("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from("exercises")
      .select("id, name")
      .order("name")
      .limit(500)
      .then(({ data }) => setExercises(data ?? []));

    if (goal) {
      setType(goal.type);
      setTitle(goal.title);
      setExerciseId(goal.exercise_id ?? "");
      setStartValue(String(goal.start_value));
      setTargetValue(String(goal.target_value));
      setUnit(goal.unit);
      setDeadline(goal.deadline ?? "");
    } else {
      setType("exercise_load");
      setTitle("");
      setExerciseId("");
      setStartValue("0");
      setTargetValue("");
      setUnit("kg");
      setDeadline("");
    }
  }, [open, goal]);

  useEffect(() => {
    const t = types.find((t) => t.value === type);
    if (t && !goal) setUnit(t.unit);
  }, [type, goal]);

  async function applyTemplate(tpl: Template) {
    setType(tpl.type);
    setTitle(tpl.title);
    setUnit(tpl.unit);

    if (tpl.type === "bodyweight" && user) {
      const latest = await getLatestMeasurement(user.id);
      const start = latest?.weight ?? 75;
      setStartValue(String(start));
      const target = Math.max(30, start + tpl.target); // tpl.target é delta (ex: -5)
      setTargetValue(String(target));
    } else {
      setStartValue("0");
      setTargetValue(String(tpl.target));
    }

    if (tpl.daysAhead) {
      const d = new Date();
      d.setDate(d.getDate() + tpl.daysAhead);
      setDeadline(d.toISOString().slice(0, 10));
    } else {
      setDeadline("");
    }
  }

  async function save() {
    if (!user) return;
    if (!title.trim()) return toast.error("Dê um nome para a meta");
    const target = parseFloat(targetValue);
    if (isNaN(target) || target < 0) return toast.error("Defina um valor-alvo válido");
    if (type === "exercise_load" && !exerciseId && !goal) {
      return toast.error("Selecione o exercício");
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      type,
      title: title.trim(),
      exercise_id: type === "exercise_load" && exerciseId ? exerciseId : null,
      start_value: parseFloat(startValue) || 0,
      target_value: target,
      unit: unit || "un",
      deadline: deadline || null,
    };

    const { error } = goal
      ? await supabase.from("goals").update(payload).eq("id", goal.id)
      : await supabase.from("goals").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar meta");
      return;
    }
    toast.success(goal ? "Meta atualizada" : "Meta criada");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold tracking-tight">
            {goal ? "Editar meta" : "Nova meta"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Templates rápidos — só na criação */}
          {!goal && (
            <div>
              <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" /> Templates rápidos
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => void applyTemplate(tpl)}
                    className="flex items-center gap-2 rounded-2xl border border-border bg-secondary p-2.5 text-left text-xs font-bold transition hover:border-primary/40 hover:bg-secondary/70"
                  >
                    <span className="text-base">{tpl.emoji}</span>
                    <span className="truncate">{tpl.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    type === t.value
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border bg-secondary hover:border-primary/40"
                  }`}
                >
                  <div className="text-sm font-extrabold">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Supino reto 100kg"
              className="h-12 rounded-2xl border-border bg-secondary"
            />
          </div>

          {type === "exercise_load" && (
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Exercício</Label>
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-secondary px-4 text-sm font-medium"
              >
                <option value="">Selecione…</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Início</Label>
              <Input
                type="number"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className="h-12 rounded-2xl border-border bg-secondary"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="h-12 rounded-2xl border-border bg-secondary"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Unidade</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-12 rounded-2xl border-border bg-secondary"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Prazo (opcional)</Label>
            <Input
              type="date"
              value={deadline}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-12 rounded-2xl border-border bg-secondary"
            />
          </div>

          <Button
            onClick={save}
            disabled={saving}
            className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-glow hover:bg-primary/90"
          >
            {saving ? "Salvando…" : goal ? "Salvar alterações" : "Criar meta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
