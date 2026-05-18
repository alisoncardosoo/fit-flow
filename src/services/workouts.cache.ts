import type { QueryClient } from "@tanstack/react-query";

/** Chave de cache da página de Treinos. */
export const workoutsPageKey = (userId: string | undefined) =>
  ["workouts-page", userId] as const;

/**
 * Invalida o cache da lista de treinos para o usuário atual.
 * Use após qualquer criação, importação, edição ou reparo de treino.
 */
export function invalidateWorkoutsCache(qc: QueryClient, userId: string | undefined) {
  qc.invalidateQueries({ queryKey: workoutsPageKey(userId) });
}

/**
 * Força um refetch da lista de treinos e aguarda o resultado.
 * Use quando a navegação seguinte depende dos dados já atualizados.
 */
export function refetchWorkoutsCache(qc: QueryClient, userId: string | undefined) {
  return qc.refetchQueries({ queryKey: workoutsPageKey(userId), exact: true });
}
