import { supabase } from "@/integrations/supabase/client";

export type RoutineSheet = {
  id: string;
  workout_id: string;
  name: string;
  description: string | null;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

const ALPHA = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export function nextSheetName(existing: { name: string }[]): string {
  const used = new Set(existing.map((s) => s.name.trim().toUpperCase()));
  for (const letter of ALPHA) {
    if (!used.has(letter)) return letter;
  }
  return `Ficha ${existing.length + 1}`;
}

export async function listSheets(workoutId: string): Promise<RoutineSheet[]> {
  const { data, error } = await supabase
    .from("routine_sheets")
    .select("*")
    .eq("workout_id", workoutId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RoutineSheet[];
}

export async function createSheet(workoutId: string, name: string, position: number): Promise<RoutineSheet> {
  const { data, error } = await supabase
    .from("routine_sheets")
    .insert({ workout_id: workoutId, name, position })
    .select()
    .single();
  if (error) throw error;
  return data as RoutineSheet;
}

export async function renameSheet(id: string, name: string) {
  await supabase.from("routine_sheets").update({ name }).eq("id", id);
}

export async function updateSheetDescription(id: string, description: string | null) {
  await supabase.from("routine_sheets").update({ description }).eq("id", id);
}

export async function deleteSheet(id: string) {
  await supabase.from("routine_sheets").delete().eq("id", id);
}

export async function reorderSheets(sheets: { id: string }[]) {
  await Promise.all(
    sheets.map((s, idx) =>
      supabase.from("routine_sheets").update({ position: idx }).eq("id", s.id),
    ),
  );
}

/** Duplicates a sheet (with all its exercises) inside the same workout. */
export async function duplicateSheet(sheetId: string): Promise<RoutineSheet> {
  const { data: src, error } = await supabase
    .from("routine_sheets")
    .select("*, workout_exercises(*)")
    .eq("id", sheetId)
    .single();
  if (error || !src) throw error ?? new Error("Sheet not found");

  // Determine new position + name
  const { data: siblings } = await supabase
    .from("routine_sheets")
    .select("name, position")
    .eq("workout_id", src.workout_id);
  const newName = nextSheetName(siblings ?? []);
  const newPos = (siblings?.length ?? 1);

  const { data: newSheet, error: e2 } = await supabase
    .from("routine_sheets")
    .insert({
      workout_id: src.workout_id,
      name: `${newName}`,
      description: src.description,
      position: newPos,
    })
    .select()
    .single();
  if (e2 || !newSheet) throw e2 ?? new Error("Failed to duplicate sheet");

  const exercises = (src.workout_exercises ?? []) as Array<{
    exercise_id: string;
    position: number;
    target_sets: number;
    target_reps: number;
    target_weight: number | null;
    rest_seconds: number;
    notes: string | null;
  }>;
  if (exercises.length) {
    await supabase.from("workout_exercises").insert(
      exercises.map((e) => ({
        exercise_id: e.exercise_id,
        position: e.position,
        target_sets: e.target_sets,
        target_reps: e.target_reps,
        target_weight: e.target_weight ?? 0,
        rest_seconds: e.rest_seconds,
        notes: e.notes,
        sheet_id: newSheet.id,
        workout_id: src.workout_id,
      })),
    );
  }
  return newSheet as RoutineSheet;
}
