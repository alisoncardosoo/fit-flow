import { motion } from "framer-motion";
import { Play, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RoutineSheet } from "@/lib/sheets";

type Props = {
  open: boolean;
  onClose: () => void;
  sheets: RoutineSheet[];
  suggestedId: string | null;
  exerciseCounts: Record<string, number>;
  onPick: (sheetId: string) => void;
};

export function SheetPicker({ open, onClose, sheets, suggestedId, exerciseCounts, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ListChecks className="h-4 w-4 text-primary" />
            Qual ficha vai treinar?
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {sheets.map((s, i) => {
            const count = exerciseCounts[s.id] ?? 0;
            const isSuggested = s.id === suggestedId;
            return (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onPick(s.id)}
                disabled={count === 0}
                className={`group relative flex items-center gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.98] disabled:opacity-40 ${
                  isSuggested
                    ? "border-primary/60 bg-primary/10 shadow-glow"
                    : "border-border bg-secondary hover:border-primary/40"
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-xl font-extrabold ${
                    isSuggested ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                  }`}
                >
                  {s.name.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-bold">Ficha {s.name}</div>
                    {isSuggested && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                        Sugerida
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {count === 0
                      ? "Sem exercícios"
                      : `${count} ${count === 1 ? "exercício" : "exercícios"}`}
                    {s.description ? ` · ${s.description}` : ""}
                  </div>
                </div>
                <Play className="h-5 w-5 fill-current text-primary opacity-0 transition group-hover:opacity-100" />
              </motion.button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
