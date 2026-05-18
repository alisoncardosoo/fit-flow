-- Update notification trigger functions to prefer @username over display_name
-- when generating notification text. Falls back to display_name (or "Alguém" /
-- "Seu amigo") when the user has not set a username yet.

-- Helper: builds the public handle. SECURITY DEFINER + STABLE so it can be
-- safely reused inside triggers and RLS-aware contexts.
CREATE OR REPLACE FUNCTION public.public_handle(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF('@' || NULLIF(p.username, ''), '@'),
    NULLIF(p.display_name, ''),
    'Alguém'
  )
  FROM public.profiles p
  WHERE p.user_id = _user_id;
$$;

-- 1) Friend request received
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requester_handle TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    requester_handle := public.public_handle(NEW.requester_id);

    INSERT INTO public.notifications (user_id, type, title, body, payload)
    VALUES (
      NEW.addressee_id,
      'friend_request',
      'Novo convite de amizade',
      requester_handle || ' quer treinar com você',
      jsonb_build_object('friendship_id', NEW.id, 'from_user_id', NEW.requester_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Friend request accepted
CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  addressee_handle TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    addressee_handle := public.public_handle(NEW.addressee_id);

    INSERT INTO public.notifications (user_id, type, title, body, payload)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Convite aceito! 🎉',
      addressee_handle || ' agora é seu parceiro de treino',
      jsonb_build_object('friend_id', NEW.addressee_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Friend finished a workout (fans out to all accepted friends)
CREATE OR REPLACE FUNCTION public.notify_friends_workout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_handle TEXT;
  friend_id UUID;
BEGIN
  IF NEW.finished_at IS NOT NULL
     AND (OLD.finished_at IS NULL OR OLD.finished_at IS DISTINCT FROM NEW.finished_at) THEN

    user_handle := public.public_handle(NEW.user_id);

    FOR friend_id IN
      SELECT CASE WHEN requester_id = NEW.user_id THEN addressee_id ELSE requester_id END
      FROM public.friendships
      WHERE status = 'accepted'
        AND (requester_id = NEW.user_id OR addressee_id = NEW.user_id)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, payload)
      VALUES (
        friend_id,
        'friend_workout',
        user_handle || ' treinou hoje 💪',
        NEW.workout_name,
        jsonb_build_object('session_id', NEW.id, 'from_user_id', NEW.user_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Reaction received on your session
CREATE OR REPLACE FUNCTION public.notify_reaction_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner_id UUID;
  reactor_handle TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.workout_sessions WHERE id = NEW.session_id;
  IF owner_id IS NULL OR owner_id = NEW.from_user_id THEN
    RETURN NEW;
  END IF;

  reactor_handle := public.public_handle(NEW.from_user_id);

  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    owner_id,
    'reaction_received',
    reactor_handle || ' reagiu ao seu treino',
    CASE NEW.emoji::text
      WHEN 'flex' THEN '💪'
      WHEN 'fire' THEN '🔥'
      WHEN 'clap' THEN '👏'
    END,
    jsonb_build_object('session_id', NEW.session_id, 'from_user_id', NEW.from_user_id, 'emoji', NEW.emoji)
  );
  RETURN NEW;
END;
$$;

-- 5) Someone joined a challenge you created
CREATE OR REPLACE FUNCTION public.notify_challenge_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ch RECORD;
  joiner_handle TEXT;
BEGIN
  SELECT title, creator_id INTO ch FROM public.challenges WHERE id = NEW.challenge_id;
  IF ch.creator_id IS NULL OR ch.creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  joiner_handle := public.public_handle(NEW.user_id);

  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    ch.creator_id,
    'challenge_invite',
    joiner_handle || ' entrou no seu desafio',
    ch.title,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'from_user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;