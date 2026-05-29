-- Suporte a push nativo (APNs/iOS) via Capacitor.
-- Adiciona uma coluna `platform` para distinguir destinos Web Push (VAPID) de
-- destinos nativos (APNs). Migração aditiva e idempotente — não afeta as
-- inscrições web existentes (que passam a contar como 'web').

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';

-- Backfill explícito por segurança (linhas antigas = web).
UPDATE public.push_subscriptions SET platform = 'web' WHERE platform IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform
  ON public.push_subscriptions(platform);
