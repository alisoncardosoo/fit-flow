import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, ScanLine, X, Sparkles, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { invalidateWorkoutsCache, refetchWorkoutsCache } from "@/services/workouts.cache";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type ImportResult = {
  workouts: Array<{ id: string; name: string }>;
  created_exercises: number;
  primary_workout_id: string;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

async function compressImage(file: File, maxDim = 1280, quality = 0.78): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read fail"));
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("img fail"));
    i.src = dataUrl;
  });

  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  // Iteratively lower quality so base64 payload stays under ~4MB (safe for edge function)
  let q = quality;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > 4_000_000 && q > 0.4) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

export function ImportWorkoutDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (workoutId: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  function reset() {
    setPreview(null);
    setLoading(false);
    setResult(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Imagem muito grande (máx 8MB)");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
    } catch {
      toast.error("Não foi possível ler a imagem");
    }
  }

  async function handleImport() {
    if (!preview) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-workout-from-image", {
        body: { image_data_url: preview },
      });
      if (error) {
        const msg = error.message ?? "Erro ao importar";
        toast.error(msg.includes("429") ? "Muitas requisições. Tente em instantes." : msg);
        return;
      }
      if (!data?.primary_workout_id) {
        toast.error("Não consegui identificar treinos na imagem");
        return;
      }
      setResult(data as ImportResult);
      // Garante que a aba de Treinos já mostre os novos treinos importados,
      // mesmo se o usuário fechar o diálogo em vez de tocar para abrir.
      invalidateWorkoutsCache(queryClient, user?.id);
      await refetchWorkoutsCache(queryClient, user?.id);
      toast.success(
        (data.workouts.length === 1
          ? "Treino importado!"
          : `${data.workouts.length} treinos importados!`) +
          (data.created_exercises > 0 ? ` ${data.created_exercises} exercício(s) novo(s) na biblioteca.` : ""),
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao importar treino");
    } finally {
      setLoading(false);
    }
  }

  function openWorkout(id: string) {
    reset();
    onClose();
    onImported(id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md rounded-3xl border-border bg-card p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <ScanLine className="h-5 w-5 text-primary" /> Importar de imagem
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 pt-2">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center text-center py-2">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div className="font-display text-lg font-bold">
                    {result.workouts.length === 1 ? "Treino criado!" : `${result.workouts.length} treinos criados!`}
                  </div>
                  {result.created_exercises > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.created_exercises} exercício{result.created_exercises > 1 ? "s" : ""} adicionado{result.created_exercises > 1 ? "s" : ""} à sua biblioteca
                    </p>
                  )}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.workouts.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => openWorkout(w.id)}
                      className="card-premium w-full rounded-2xl p-4 text-left transition hover:scale-[1.01]"
                    >
                      <div className="font-semibold">{w.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Tocar para abrir e ajustar</div>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                >
                  Fechar
                </Button>
              </motion.div>
            ) : preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary">
                  <img src={preview} alt="Pré-visualização do treino" className="w-full max-h-72 object-contain" />
                  {!loading && (
                    <button
                      onClick={reset}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur"
                      aria-label="Remover imagem"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={handleImport}
                  disabled={loading}
                  className="h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 shadow-glow"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo treino com IA…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Importar com IA
                    </>
                  )}
                </Button>
                {loading && (
                  <p className="text-center text-xs text-muted-foreground">
                    Pode levar até 30s. A IA está identificando exercícios, séries e repetições.
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  Tire uma foto ou envie uma imagem do seu treino (planilha do personal, ficha da academia, print de app). A IA cria as fichas automaticamente.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => cameraRef.current?.click()}
                    className="card-premium flex flex-col items-center gap-2 rounded-2xl p-5 transition hover:scale-[1.02]"
                  >
                    <Camera className="h-7 w-7 text-primary" />
                    <span className="text-sm font-semibold">Câmera</span>
                  </button>
                  <button
                    onClick={() => galleryRef.current?.click()}
                    className="card-premium flex flex-col items-center gap-2 rounded-2xl p-5 transition hover:scale-[1.02]"
                  >
                    <ImageIcon className="h-7 w-7 text-primary" />
                    <span className="text-sm font-semibold">Galeria</span>
                  </button>
                </div>
                <div className="rounded-xl bg-secondary/60 p-3 text-[11px] text-muted-foreground">
                  💡 Dica: imagens nítidas e bem iluminadas funcionam melhor. A IA detecta múltiplas fichas (A, B, C…) automaticamente.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
