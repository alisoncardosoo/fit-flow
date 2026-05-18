import { supabase } from "@/integrations/supabase/client";

export type WorkoutExerciseSummary = {
  id: string;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
  sheet_id: string | null;
};

export type WorkoutListItem = {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  color: string | null;
  updated_at: string;
  workout_exercises: WorkoutExerciseSummary[];
  routine_sheets: { id: string }[];
};

export type RecentSession = {
  workout_id: string | null;
  started_at: string;
};

export type WorkoutsData = {
  workouts: WorkoutListItem[];
  sessions: RecentSession[];
};

export async function fetchWorkoutsData(): Promise<WorkoutsData> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  // IMPORTANTE: `workouts` tem DUAS relações com `routine_sheets`
  // (routine_sheets.workout_id -> workouts.id  e  workouts.last_sheet_id -> routine_sheets.id).
  // Sem desambiguar, o PostgREST devolve PGRST201 e a lista fica vazia.
  // Por isso usamos a sintaxe `tabela!nome_da_fk` para forçar o relacionamento correto.
  const [workoutsRes, sessionsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select(
        "id, name, description, archived, color, updated_at, " +
          "workout_exercises!workout_exercises_workout_id_fkey(id, target_sets, target_reps, rest_seconds, sheet_id), " +
          "routine_sheets!routine_sheets_workout_id_fkey(id)",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("workout_sessions")
      .select("workout_id, started_at")
      .not("finished_at", "is", null)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false }),
  ]);

  if (workoutsRes.error) {
    console.error("fetchWorkoutsData workouts error:", workoutsRes.error);
    throw workoutsRes.error;
  }
  if (sessionsRes.error) {
    console.error("fetchWorkoutsData sessions error:", sessionsRes.error);
    throw sessionsRes.error;
  }

  return {
    workouts: (workoutsRes.data as unknown as WorkoutListItem[]) ?? [],
    sessions: (sessionsRes.data as RecentSession[]) ?? [],
  };
}
