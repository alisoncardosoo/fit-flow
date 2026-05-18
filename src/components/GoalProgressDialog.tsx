import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { upsertMeasurement, getLatestMeasurement } from "@/services/measurements.service";
import { toast } from "sonner";
import type { GoalWithProgress } from "@/hooks/useGoalProgress";
import { Scale, Target } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: GoalWithProgress | null;
  onSaved: () => void;
}

/**
 * Diálogo para registrar progresso manual de uma meta:
 *  - bodyweight → grava em body_measurements (peso de hoje, atualiza se já existir)
 *  - custom     → grava em goals.current_override
 * Não é exibido para tipos automáticos (carga / frequência).
 */
export function GoalProgressDialog({ open, onOpenChange, goal, onSaved }: Props) {
  const { user } = useAuth();
  const [value, setValue] = useState<string>("");
  const [bodyFat, setBodyFat] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !goal) return;
    setValue(String(goal.current_value ?? ""));
    setDate(new Date().toISOString().slice(0, 10));

    if (goal.type === "bodyweight" && user) {
      void getLatestMeasurement(user.id).then((m) => {
        if (m?.body_fat != null) setBodyFat(String(m.body_fat));
        else setBodyFat("");
      });
    } else {
      setBodyFat("");
    }
  }, [open, goal, user]);

  if (!goal) return null;

  const isWeight = goal.type === "bodyweight";
  const isCustom = goal.type === "custom";
  if (!isWeight && !isCustom) return null;

  async function save() {
    if (!user || !goal) return;
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      if (isWeight) {
        const fat = bodyFat.trim() === "" ? null : parseFloat(bodyFat);
        await upsertMeasurement({
          user_id: user.id,
          weight: num,
          body_fat: fat != null && !isNaN(fat) ? fat : null,
          measured_at: date,
        });
        toast.success("Peso registrado 💪");
      } else {
        const { error } = await supabase
          .from("goals")
          .update({ current_override: num })
          .eq("id", goal.id);
        if (error) throw error;
        toast.success("Progresso atualizado");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const Icon = isWeight ? Scale : Target;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display text-xl font-extrabold tracking-tight">
            {isWeight ? "Registrar peso" : "Atualizar progresso"}
          </DialogTitle>
          <p className="text-center text-xs text-muted-foreground">{goal.title}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isWeight ? "Peso atual" : "Valor atual"} ({goal.unit})
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-14 rounded-2xl border-border bg-secondary text-center font-display text-2xl font-extrabold"
            />
          </div>

          {isWeight && (
            <>
              <div>
                <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Gordura corporal (% — opcional)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                  placeholder="Ex: 18"
                  className="h-12 rounded-2xl border-border bg-secondary"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Data
                </Label>
                <Input
                  type="date"
                  value={date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 rounded-2xl border-border bg-secondary"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Apenas 1 medida por dia — gravar substitui a anterior.
                </p>
              </div>
            </>
          )}

          <Button
            onClick={save}
            disabled={saving}
            className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-glow hover:bg-primary/90"
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
