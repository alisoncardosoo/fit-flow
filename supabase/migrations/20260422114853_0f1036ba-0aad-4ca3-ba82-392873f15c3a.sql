
-- 1. Restrict profiles SELECT: only self + friends. Drop the broad authenticated read.
DROP POLICY IF EXISTS "Public profile basics viewable" ON public.profiles;

CREATE POLICY "Friends view profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.are_friends(auth.uid(), user_id));

-- Helper function for safe public lookups (only returns harmless social fields).
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.username
  FROM public.profiles p
  WHERE p.user_id = ANY(_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- 2. Prevent privilege escalation on exercises: users cannot flip is_public via UPDATE.
DROP POLICY IF EXISTS "Users update own exercises" ON public.exercises;
CREATE POLICY "Users update own exercises"
ON public.exercises
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND is_public = false);

-- 3. Lock get_friend_comparison: caller must be _me and must be friends with _friend (or compare to self).
CREATE OR REPLACE FUNCTION public.get_friend_comparison(_me uuid, _friend uuid, _days integer DEFAULT 30)
 RETURNS TABLE(user_id uuid, display_name text, sessions integer, total_volume numeric, frequency_days integer, avg_duration_min numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _me THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _me <> _friend AND NOT public.are_friends(_me, _friend) THEN
    RAISE EXCEPTION 'Not friends';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT _me AS uid UNION SELECT _friend
  ),
  stats AS (
    SELECT
      ws.user_id,
      COUNT(*)::INT AS sessions,
      COALESCE(SUM(ws.total_volume), 0)::NUMERIC AS total_volume,
      COUNT(DISTINCT ws.started_at::DATE)::INT AS frequency_days,
      COALESCE(AVG(ws.duration_seconds) / 60.0, 0)::NUMERIC AS avg_duration_min
    FROM public.workout_sessions ws
    JOIN targets t ON t.uid = ws.user_id
    WHERE ws.finished_at IS NOT NULL
      AND ws.finished_at >= now() - (_days || ' days')::INTERVAL
    GROUP BY ws.user_id
  )
  SELECT
    t.uid,
    COALESCE(p.display_name, 'Atleta'),
    COALESCE(s.sessions, 0),
    COALESCE(s.total_volume, 0),
    COALESCE(s.frequency_days, 0),
    COALESCE(s.avg_duration_min, 0)
  FROM targets t
  LEFT JOIN public.profiles p ON p.user_id = t.uid
  LEFT JOIN stats s ON s.user_id = t.uid;
END;
$function$;

-- 4. Tighten storage policies on exercise-images bucket.
-- Drop overly broad insert/update policies; only the service role (used by edge function) writes.
DROP POLICY IF EXISTS "Authenticated users can upload exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update exercise images" ON storage.objects;

-- 5. Restrict listing of the public exercise-images bucket: only allow direct file reads (by URL),
-- not arbitrary listings. We keep public reads via getPublicUrl but remove SELECT from authenticated/anon.
-- Public URL access goes through Supabase's public-bucket CDN path and does not require this SELECT policy.
DROP POLICY IF EXISTS "Anyone views exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Public read exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view exercise images" ON storage.objects;

-- 6. Realtime authorization: restrict who can subscribe to channels.
-- Our app uses postgres_changes (already RLS-gated) and not broadcast/presence.
-- Add a basic authenticated-only policy on realtime.messages so unauthenticated clients
-- cannot subscribe to arbitrary channels.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
