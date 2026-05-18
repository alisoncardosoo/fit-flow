-- 1) Deduplicate existing achievements before adding the unique constraint
DELETE FROM public.achievements a
USING public.achievements b
WHERE a.user_id = b.user_id
  AND a.code = b.code
  AND a.earned_at > b.earned_at;

-- Edge case: equal timestamps — keep the lowest id
DELETE FROM public.achievements a
USING public.achievements b
WHERE a.user_id = b.user_id
  AND a.code = b.code
  AND a.earned_at = b.earned_at
  AND a.id > b.id;

-- 2) Unique constraint on (user_id, code)
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_user_code_unique UNIQUE (user_id, code);

-- 3) TTL cleanup for abandoned active_sessions (>6h since updated_at)
CREATE OR REPLACE FUNCTION public.cleanup_stale_active_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.active_sessions
  WHERE updated_at < now() - INTERVAL '6 hours';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_stale_active_sessions ON public.active_sessions;
CREATE TRIGGER trg_cleanup_stale_active_sessions
AFTER INSERT OR UPDATE ON public.active_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_stale_active_sessions();