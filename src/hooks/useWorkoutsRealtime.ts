import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateWorkoutsCache } from "@/services/workouts.cache";

/**
 * Mantém a lista da página de Treinos sincronizada em tempo real.
 * Sempre que `workouts`, `routine_sheets`, `workout_exercises`
 * ou `workout_sessions` mudarem, o cache é invalidado.
 */
export function useWorkoutsRealtime(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`workouts-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts" },
        () => invalidateWorkoutsCache(qc, userId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "routine_sheets" },
        () => invalidateWorkoutsCache(qc, userId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_exercises" },
        () => invalidateWorkoutsCache(qc, userId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_sessions" },
        () => invalidateWorkoutsCache(qc, userId),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
