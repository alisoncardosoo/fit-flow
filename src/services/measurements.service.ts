import { supabase } from "@/integrations/supabase/client";

export type BodyMeasurement = {
  id: string;
  user_id: string;
  weight: number;
  body_fat: number | null;
  notes: string | null;
  measured_at: string; // YYYY-MM-DD
  created_at: string;
};

export async function listMeasurements(userId: string, limit = 90): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((m) => ({ ...m, weight: Number(m.weight), body_fat: m.body_fat == null ? null : Number(m.body_fat) }));
}

export async function getLatestMeasurement(userId: string): Promise<BodyMeasurement | null> {
  const { data } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { ...data, weight: Number(data.weight), body_fat: data.body_fat == null ? null : Number(data.body_fat) };
}

export async function upsertMeasurement(input: {
  user_id: string;
  weight: number;
  body_fat?: number | null;
  measured_at?: string; // YYYY-MM-DD; default today
  notes?: string | null;
}): Promise<void> {
  const today = input.measured_at ?? new Date().toISOString().slice(0, 10);
  // upsert por (user_id, measured_at) — só 1 medida por dia
  const { error } = await supabase
    .from("body_measurements")
    .upsert(
      {
        user_id: input.user_id,
        weight: input.weight,
        body_fat: input.body_fat ?? null,
        notes: input.notes ?? null,
        measured_at: today,
      },
      { onConflict: "user_id,measured_at" },
    );
  if (error) throw error;
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from("body_measurements").delete().eq("id", id);
  if (error) throw error;
}
