-- ============ NOTIFICATIONS ============
CREATE TYPE public.notification_type AS ENUM (
  'friend_request',
  'friend_accepted',
  'friend_workout',
  'reaction_received',
  'challenge_invite',
  'challenge_overtaken',
  'challenge_won'
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
-- Inserts happen via SECURITY DEFINER triggers; no direct insert policy needed.

-- ============ ACTIVE SESSIONS (presence) ============
CREATE TABLE public.active_sessions (
  user_id UUID NOT NULL PRIMARY KEY,
  session_id UUID NOT NULL,
  workout_name TEXT NOT NULL,
  current_exercise_index INTEGER NOT NULL DEFAULT 0,
  total_exercises INTEGER NOT NULL DEFAULT 0,
  current_exercise_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own active session" ON public.active_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Friends view active sessions" ON public.active_sessions
  FOR SELECT USING (public.are_friends(auth.uid(), user_id));

-- ============ TRIGGERS: auto-notifications ============

-- New friend request -> notify addressee
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requester_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT COALESCE(display_name, 'Alguém') INTO requester_name
    FROM public.profiles WHERE user_id = NEW.requester_id;

    INSERT INTO public.notifications (user_id, type, title, body, payload)
    VALUES (
      NEW.addressee_id,
      'friend_request',
      'Novo convite de amizade',
      requester_name || ' quer treinar com você',
      jsonb_build_object('friendship_id', NEW.id, 'from_user_id', NEW.requester_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_friend_request
AFTER INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

-- Friendship accepted -> notify requester
CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  addressee_name TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT COALESCE(display_name, 'Alguém') INTO addressee_name
    FROM public.profiles WHERE user_id = NEW.addressee_id;

    INSERT INTO public.notifications (user_id, type, title, body, payload)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Convite aceito! 🎉',
      addressee_name || ' agora é seu parceiro de treino',
      jsonb_build_object('friend_id', NEW.addressee_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_friend_accepted
AFTER UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_accepted();

-- Workout finished -> notify all accepted friends
CREATE OR REPLACE FUNCTION public.notify_friends_workout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_name TEXT;
  friend_id UUID;
BEGIN
  IF NEW.finished_at IS NOT NULL
     AND (OLD.finished_at IS NULL OR OLD.finished_at IS DISTINCT FROM NEW.finished_at) THEN

    SELECT COALESCE(display_name, 'Seu amigo') INTO user_name
    FROM public.profiles WHERE user_id = NEW.user_id;

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
        user_name || ' treinou hoje 💪',
        NEW.workout_name,
        jsonb_build_object('session_id', NEW.id, 'from_user_id', NEW.user_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_friends_workout
AFTER UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.notify_friends_workout();

-- Reaction received -> notify session owner
CREATE OR REPLACE FUNCTION public.notify_reaction_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id UUID;
  reactor_name TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.workout_sessions WHERE id = NEW.session_id;
  IF owner_id IS NULL OR owner_id = NEW.from_user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Alguém') INTO reactor_name
  FROM public.profiles WHERE user_id = NEW.from_user_id;

  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    owner_id,
    'reaction_received',
    reactor_name || ' reagiu ao seu treino',
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

CREATE TRIGGER trg_notify_reaction_received
AFTER INSERT ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_reaction_received();

-- ============ COMPARISON RPC ============
CREATE OR REPLACE FUNCTION public.get_friend_comparison(_me UUID, _friend UUID, _days INTEGER DEFAULT 30)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  sessions INTEGER,
  total_volume NUMERIC,
  frequency_days INTEGER,
  avg_duration_min NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- ============ INVITE participant to challenge (notification helper) ============
CREATE OR REPLACE FUNCTION public.notify_challenge_join()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ch RECORD;
  joiner_name TEXT;
BEGIN
  SELECT title, creator_id INTO ch FROM public.challenges WHERE id = NEW.challenge_id;
  IF ch.creator_id IS NULL OR ch.creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Alguém') INTO joiner_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    ch.creator_id,
    'challenge_invite',
    joiner_name || ' entrou no seu desafio',
    ch.title,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'from_user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_challenge_join
AFTER INSERT ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_join();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sessions;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.active_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.workout_sessions REPLICA IDENTITY FULL;