import { useRef, useState } from "react";
import { Upload, Sparkles, RotateCcw, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { setUserOverride } from "@/lib/exerciseImageCache";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string;
  exerciseName: string;
  /** Se o exercício já tem uma imagem nativa (vinda do exercise.image_url ou catálogo) */
  hasDefaultImage: boolean;
  /** Chamado após salvar nova imagem (override ou exercício próprio) */
  onChanged: (newUrl: string | null) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function ExerciseImagePicker({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
  hasDefaultImage,
  onChanged,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Imagem muito grande (máx 5 MB)");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${exerciseId}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("exercise-images")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("exercise-images").getPublicUrl(path);
      const image_url = pub.publicUrl;

      // Verifica se é dono do exercício (custom) ou se precisa de override
      const { data: ex } = await supabase
        .from("exercises")
        .select("user_id")
        .eq("id", exerciseId)
        .maybeSingle();

      if (ex?.user_id === user.id) {
        await supabase.from("exercises").update({ image_url }).eq("id", exerciseId);
      } else {
        await supabase
          .from("exercise_image_overrides")
          .upsert(
            { user_id: user.id, exercise_id: exerciseId, image_url, source: "upload" },
            { onConflict: "user_id,exercise_id" },
          );
        setUserOverride(exerciseId, image_url);
      }

      onChanged(image_url);
      toast.success("Imagem atualizada!");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerateAI() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-exercise-image", {
        body: { exercise_id: exerciseId, force: true },
      });
      if (error) throw error;
      const image_url = data?.image_url as string | undefined;
      if (!image_url) throw new Error("Resposta sem imagem");

      // Atualiza override local (a edge function decide entre exercise.image_url e override)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ex } = await supabase
        .from("exercises")
        .select("user_id")
        .eq("id", exerciseId)
        .maybeSingle();
      if (user && ex?.user_id !== user.id) {
        setUserOverride(exerciseId, image_url);
      }

      onChanged(image_url);
      toast.success("Imagem gerada com IA!");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Erro ao gerar imagem";
      if (msg.includes("429")) toast.error("Muitas requisições. Tente em alguns minutos.");
      else if (msg.includes("402")) toast.error("Créditos de IA esgotados.");
      else toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRemoveOverride() {
    setRemoving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      await supabase
        .from("exercise_image_overrides")
        .delete()
        .eq("user_id", user.id)
        .eq("exercise_id", exerciseId);
      setUserOverride(exerciseId, null);
      onChanged(null);
      toast.success("Imagem padrão restaurada");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao restaurar");
    } finally {
      setRemoving(false);
    }
  }

  const busy = uploading || generating || removing;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            Imagem do exercício
          </SheetTitle>
          <SheetDescription>
            {exerciseName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />

          <PickerOption
            icon={uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            title="Enviar do dispositivo"
            description="Foto ou imagem da galeria (máx 5 MB)"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          />

          <PickerOption
            icon={generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            title="Gerar com IA"
            description="Ilustração 3D criada para este exercício"
            disabled={busy}
            onClick={handleGenerateAI}
            accent
          />

          {hasDefaultImage && (
            <PickerOption
              icon={removing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
              title="Restaurar imagem padrão"
              description="Remove sua imagem personalizada"
              disabled={busy}
              onClick={handleRemoveOverride}
              destructive
            />
          )}

          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PickerOption({
  icon,
  title,
  description,
  onClick,
  disabled,
  accent,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        accent
          ? "border-primary/30 bg-primary/10 hover:bg-primary/15"
          : destructive
            ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
            : "border-border bg-secondary/50 hover:bg-secondary",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          accent
            ? "bg-primary/20 text-primary"
            : destructive
              ? "bg-destructive/15 text-destructive"
              : "bg-background/60 text-foreground",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}
