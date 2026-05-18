import { supabase } from "@/integrations/supabase/client";

export const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

export type UsernameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/** Pure client-side format validation (matches the Postgres trigger). */
export function validateUsernameFormat(raw: string): UsernameValidation {
  const value = raw.trim().toLowerCase();
  if (value.length < 3) return { ok: false, reason: "Mínimo 3 caracteres." };
  if (value.length > 20) return { ok: false, reason: "Máximo 20 caracteres." };
  if (!USERNAME_REGEX.test(value)) {
    return {
      ok: false,
      reason: "Use apenas letras minúsculas, números, '_' ou '.'.",
    };
  }
  return { ok: true, value };
}

/** Suggest a default handle from a display name or email. */
export function suggestUsername(seed: string | null | undefined): string {
  const base = (seed ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = base.replace(/[^a-z0-9_.]/g, "").slice(0, 16);
  if (cleaned.length >= 3) return cleaned;
  return `atleta${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_username_available", {
    _username: username,
  });
  if (error) throw error;
  return !!data;
}

/** Save the username to the current user's profile. Throws on conflict/format. */
export async function setUsername(userId: string, username: string): Promise<void> {
  const v = validateUsernameFormat(username);
  if (!v.ok) throw new Error(v.reason);
  const { error } = await supabase
    .from("profiles")
    .update({ username: v.value })
    .eq("user_id", userId);
  if (error) {
    if (error.code === "23505") throw new Error("Esse @ já está em uso.");
    throw error;
  }
}
