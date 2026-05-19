-- Fix push dispatch reliability:
-- 1) point trigger HTTP call to current project ref
-- 2) keep notification insert resilient even if push dispatch fails

CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url TEXT := 'https://ebnoiynvjpdcuomblwzv.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM extensions.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break notification insert because of push dispatch errors
  RETURN NEW;
END;
$$;
