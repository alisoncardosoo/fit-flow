import { useEffect, useState } from "react";

/**
 * Modo debug visual para os FilterPills.
 *
 * Ativação:
 *  - URL: adicionar `?debug=filters` em qualquer rota.
 *  - Atalho: pressionar `Shift + D` (toggle global durante a sessão).
 *
 * Quando ativo:
 *  - O bounding-box real de cada pill ganha um `outline` tracejado vermelho.
 *  - O container `FilterPillsRow` ganha outline ciano para indicar a área de
 *    overflow-x onde o glow do pill ativo NÃO PODE vazar.
 *  - Pills ativos exibem um anel âmbar `-inset-2` mostrando até onde uma
 *    sombra/degradê *poderia* se estender — se aparecer fora do outline ciano,
 *    é um artefato a corrigir.
 *
 * Regra visual de PASS:
 *   anel âmbar do pill ativo ⊂ outline ciano do container
 *   (= nada de glow projetado fora do scroll viewport).
 */

const STORAGE_KEY = "ff:debugFilters";
const listeners = new Set<(v: boolean) => void>();
let current = readInitial();

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("debug") === "filters") return true;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDebug(v: boolean) {
  current = v;
  try {
    if (v) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(v));
}

let hotkeyBound = false;
function bindHotkey() {
  if (hotkeyBound || typeof window === "undefined") return;
  hotkeyBound = true;
  window.addEventListener("keydown", (e) => {
    // Shift + D (sem inputs ativos)
    const target = e.target as HTMLElement | null;
    const isTyping =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);
    if (isTyping) return;
    if (e.shiftKey && (e.key === "D" || e.key === "d")) {
      setDebug(!current);
      // eslint-disable-next-line no-console
      console.info(`[filterDebug] ${current ? "ON" : "OFF"}`);
    }
  });
}

export function useFilterDebug(): boolean {
  const [v, setV] = useState(current);
  useEffect(() => {
    bindHotkey();
    listeners.add(setV);
    setV(current);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

/** Acesso programático (útil para testes e console). */
export const filterDebug = {
  get: () => current,
  set: setDebug,
  toggle: () => setDebug(!current),
};

if (typeof window !== "undefined") {
  // Disponibiliza no console para QA manual: `__filterDebug.toggle()`
  (window as unknown as { __filterDebug?: typeof filterDebug }).__filterDebug = filterDebug;
}
