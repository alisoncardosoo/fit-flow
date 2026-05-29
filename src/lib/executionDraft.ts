import type { Item, SetEntry } from "@/pages/Execute";

/**
 * Snapshot do treino em andamento, persistido em localStorage para retomada
 * automática quando o usuário fecha/reabre o app no MESMO aparelho.
 *
 * O Supabase continua sendo a fonte de verdade da linha de `workout_sessions`
 * e dos `set_logs`; este draft é só o mecanismo rápido de restaurar a UI
 * (cronômetro, exercício atual e séries/ajustes ainda não sincronizados).
 */
export type ExecutionDraft = {
  workoutId: string;
  sheetId: string | null;
  sessionId: string;
  startedAt: number; // epoch ms — fallback do timer
  currentEx: number;
  workoutName: string;
  activeSheetId: string | null; // só o id; RoutineSheet é re-resolvido da sheetList
  items: Item[];
  setsByItem: Record<string, SetEntry[]>;
  savedAt: number; // epoch ms — controle de staleness
};

// Mesma janela do `is_training_now` em social.ts: drafts mais velhos que isso
// são tratados como abandonados.
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

const key = (userId: string, workoutId: string) =>
  `fitflow:exec-draft:${userId}:${workoutId}`;

export function saveDraft(userId: string, d: ExecutionDraft): void {
  try {
    localStorage.setItem(key(userId, d.workoutId), JSON.stringify(d));
  } catch {
    // quota cheia ou storage indisponível — ignora silenciosamente.
  }
}

export function loadDraft(userId: string, workoutId: string): ExecutionDraft | null {
  try {
    const raw = localStorage.getItem(key(userId, workoutId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ExecutionDraft;
    if (!d || typeof d !== "object") return null;
    if (!d.sessionId || !d.items || !d.setsByItem) return null;
    if (typeof d.savedAt !== "number" || Date.now() - d.savedAt > MAX_AGE_MS) {
      clearDraft(userId, workoutId);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string, workoutId: string): void {
  try {
    localStorage.removeItem(key(userId, workoutId));
  } catch {
    // ignora
  }
}
