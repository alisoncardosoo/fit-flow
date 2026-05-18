import { supabase } from "@/integrations/supabase/client";

const FREE_DB_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

/**
 * Cache em memória das URLs já resolvidas/carregadas durante a sessão,
 * evita re-resolver pelo banco e re-baixar a imagem ao trocar de card.
 *
 * - resolved: nome PT → URL definitiva (ou null se não tem mapeamento)
 * - loaded: URLs já decodificadas pelo navegador (prontas para exibir sem flicker)
 */
const resolvedByName = new Map<string, string | null>();
const loadedUrls = new Set<string>();
const inflight = new Map<string, Promise<string | null>>();

/**
 * Overrides pessoais do usuário (exercise_id -> image_url).
 */
const overridesByExerciseId = new Map<string, string>();
let overridesLoaded = false;

export function getUserOverride(exerciseId: string): string | undefined {
  return overridesByExerciseId.get(exerciseId);
}

export function setUserOverride(exerciseId: string, url: string | null) {
  if (url) overridesByExerciseId.set(exerciseId, url);
  else overridesByExerciseId.delete(exerciseId);
}

export async function loadUserImageOverrides() {
  if (overridesLoaded) return;
  overridesLoaded = true;
  const { data } = await supabase
    .from("exercise_image_overrides")
    .select("exercise_id, image_url");
  data?.forEach((row) => {
    if (row.image_url) overridesByExerciseId.set(row.exercise_id, row.image_url);
  });
}

export function getCachedUrl(name: string): string | null | undefined {
  return resolvedByName.get(name);
}

export function isImageLoaded(url: string | null | undefined): boolean {
  return !!url && loadedUrls.has(url);
}

export function markImageLoaded(url: string) {
  loadedUrls.add(url);
}

/**
 * Pré-carrega a imagem no navegador para que ela já esteja em cache
 * quando o componente <img> for montado. Não dispara fetch se já carregada.
 */
export function preloadImage(url: string): Promise<void> {
  if (loadedUrls.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      loadedUrls.add(url);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * Resolve uma URL de imagem para um exercício consultando o catálogo PT-BR.
 * Persiste o resultado em memória e (best-effort) no banco.
 */
export async function resolveExerciseImage(params: {
  exerciseId: string;
  name: string;
  existingUrl?: string | null;
}): Promise<string | null> {
  const { exerciseId, name, existingUrl } = params;

  if (existingUrl) {
    resolvedByName.set(name, existingUrl);
    return existingUrl;
  }

  const cached = resolvedByName.get(name);
  if (cached !== undefined) return cached;

  const pending = inflight.get(name);
  if (pending) return pending;

  const promise = (async () => {
    const { data: mapRow } = await supabase
      .from("exercise_image_map")
      .select("slug")
      .eq("exercise_name_pt", name)
      .maybeSingle();

    if (!mapRow?.slug) {
      resolvedByName.set(name, null);
      return null;
    }

    const url = `${FREE_DB_BASE}/${mapRow.slug}/0.jpg`;
    resolvedByName.set(name, url);

    // best-effort: persiste para próximas sessões
    void supabase.from("exercises").update({ image_url: url }).eq("id", exerciseId);

    return url;
  })().finally(() => {
    inflight.delete(name);
  });

  inflight.set(name, promise);
  return promise;
}

/**
 * Pré-carrega imagem de um próximo exercício durante o treino.
 * Resolve a URL (se necessário) e baixa o arquivo em background.
 */
export async function prefetchExerciseImage(params: {
  exerciseId: string;
  name: string;
  existingUrl?: string | null;
}): Promise<void> {
  const url = await resolveExerciseImage(params);
  if (url) await preloadImage(url);
}
