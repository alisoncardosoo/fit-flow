import { useEffect, useRef } from "react";

/**
 * Mantém a tela do dispositivo ligada enquanto o app estiver aberto e visível.
 * Usa a Screen Wake Lock API (suportada na maioria dos navegadores modernos).
 * Reativa automaticamente quando a aba volta a ficar visível.
 */
export function useWakeLock(enabled: boolean = true) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let cancelled = false;

    const requestLock = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        if (wakeLockRef.current) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
          }
        });
      } catch {
        // Silencioso: navegador pode bloquear (bateria fraca, política, etc.)
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestLock();
      }
    };

    requestLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      const current = wakeLockRef.current;
      wakeLockRef.current = null;
      current?.release().catch(() => {});
    };
  }, [enabled]);
}
