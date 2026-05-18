import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getCachedUrl,
  getUserOverride,
  isImageLoaded,
  markImageLoaded,
  resolveExerciseImage,
} from "@/lib/exerciseImageCache";

const MUSCLE_GRADIENT: Record<string, string> = {
  chest: "from-rose-500/30 to-orange-500/20",
  back: "from-blue-500/30 to-cyan-500/20",
  shoulders: "from-amber-500/30 to-yellow-500/20",
  biceps: "from-violet-500/30 to-purple-500/20",
  triceps: "from-fuchsia-500/30 to-pink-500/20",
  forearms: "from-indigo-500/30 to-blue-500/20",
  quads: "from-emerald-500/30 to-lime-500/20",
  hamstrings: "from-teal-500/30 to-emerald-500/20",
  glutes: "from-pink-500/30 to-rose-500/20",
  calves: "from-cyan-500/30 to-sky-500/20",
  core: "from-yellow-500/30 to-amber-500/20",
  cardio: "from-red-500/30 to-orange-500/20",
  full_body: "from-primary/30 to-emerald-500/20",
};

const MUSCLE_EMOJI: Record<string, string> = {
  chest: "💪", back: "🔙", shoulders: "🏋️", biceps: "💪", triceps: "💪",
  forearms: "✊", quads: "🦵", hamstrings: "🦵", glutes: "🍑",
  calves: "🦵", core: "🎯", cardio: "❤️", full_body: "🔥",
};

type Props = {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  imageUrl?: string | null;
  className?: string;
  /**
   * Tenta resolver a imagem a partir do catálogo público (free-exercise-db)
   * caso o exercício ainda não tenha imagem salva. Default: true.
   * Não consome créditos de IA.
   */
  autoResolve?: boolean;
  /** Callback chamado quando uma nova imagem é resolvida */
  onResolved?: (url: string) => void;
  /** Tamanho do emoji fallback */
  fallbackSize?: "sm" | "md" | "lg";
  rounded?: string;
};

export function ExerciseImage({
  exerciseId,
  name,
  muscleGroup,
  imageUrl,
  className,
  autoResolve = true,
  onResolved,
  fallbackSize = "md",
  rounded = "rounded-xl",
}: Props) {
  // Prioridade: override pessoal do usuário > prop imageUrl > cache em memória
  const initialUrl =
    getUserOverride(exerciseId) ?? imageUrl ?? getCachedUrl(name) ?? null;
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [isReady, setIsReady] = useState<boolean>(isImageLoaded(initialUrl));
  const [resolving, setResolving] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    const next =
      getUserOverride(exerciseId) ?? imageUrl ?? getCachedUrl(name) ?? null;
    setUrl(next);
    setIsReady(isImageLoaded(next));
    triggered.current = false;
  }, [imageUrl, name, exerciseId]);

  useEffect(() => {
    if (url || !autoResolve || triggered.current) return;
    triggered.current = true;

    let cancelled = false;
    setResolving(true);

    void resolveExerciseImage({ exerciseId, name, existingUrl: url })
      .then((resolved) => {
        if (cancelled || !resolved) return;
        setUrl(resolved);
        setIsReady(isImageLoaded(resolved));
        onResolved?.(resolved);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, autoResolve, exerciseId, name, onResolved]);

  const gradient = MUSCLE_GRADIENT[muscleGroup] ?? "from-primary/20 to-secondary/20";
  const emoji = MUSCLE_EMOJI[muscleGroup] ?? "🏋️";
  const emojiSize =
    fallbackSize === "sm" ? "text-lg" : fallbackSize === "lg" ? "text-5xl" : "text-2xl";

  const showSkeleton = !!url && !isReady;
  const showEmoji = !url && !resolving;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        gradient,
        rounded,
        className,
      )}
    >
      {/* Skeleton premium: shimmer sutil enquanto a imagem carrega */}
      {(showSkeleton || resolving) && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div
            className="absolute inset-y-0 -left-1/2 w-1/2 animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent"
            style={{ filter: "blur(8px)" }}
          />
        </div>
      )}

      {url && (
        <img
          src={url}
          alt={name}
          loading="lazy"
          decoding="async"
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            isReady ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => {
            markImageLoaded(url);
            setIsReady(true);
          }}
          onError={() => {
            setUrl(null);
            setIsReady(false);
          }}
        />
      )}

      {showEmoji && (
        <div className="flex h-full w-full items-center justify-center">
          <span className={emojiSize} aria-hidden>
            {emoji}
          </span>
        </div>
      )}
    </div>
  );
}
