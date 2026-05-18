-- ============================================================
-- 1. Add total_points to profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Friend codes (one per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friend_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own friend code"
  ON public.friend_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can lookup code to add friend"
  ON public.friend_codes FOR SELECT
  USING (true);

CREATE POLICY "Users insert own friend code"
  ON public.friend_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Generator: random 6-char alphanumeric (uppercase, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
  attempts INT := 0;
  exists_already BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, (floor(random() * length(chars))::int) + 1, 1);
    END LOOP;
    SELECT EXISTS (SELECT 1 FROM public.friend_codes WHERE code = result) INTO exists_already;
    EXIT WHEN NOT exists_already OR attempts > 20;
    attempts := attempts + 1;
  END LOOP;
  RETURN result;
END;
$$;

-- Auto-create friend code on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_friend_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.friend_codes (user_id, code)
  VALUES (NEW.user_id, public.generate_friend_code())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_friend_code ON public.profiles;
CREATE TRIGGER on_profile_created_friend_code
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_friend_code();

-- Backfill existing profiles
INSERT INTO public.friend_codes (user_id, code)
SELECT p.user_id, public.generate_friend_code()
FROM public.profiles p
LEFT JOIN public.friend_codes fc ON fc.user_id = p.user_id
WHERE fc.id IS NULL;

-- ============================================================
-- 3. Friendships
-- ============================================================
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  addressee_id UUID NOT NULL,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users create outgoing requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users update friendships they're part of"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users delete their friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: are two users accepted friends? (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;

-- ============================================================
-- 4. Challenges + participants
-- ============================================================
CREATE TYPE public.challenge_type AS ENUM ('most_sessions', 'most_volume', 'most_frequency');
CREATE TYPE public.challenge_period AS ENUM ('weekly', 'monthly', 'custom');

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type public.challenge_type NOT NULL DEFAULT 'most_sessions',
  period public.challenge_period NOT NULL DEFAULT 'weekly',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_period ON public.challenges(starts_at, ends_at);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_cp_user ON public.challenge_participants(user_id);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- Challenges policies (depend on participants table)
CREATE POLICY "View public or participating challenges"
  ON public.challenges FOR SELECT
  USING (
    is_public = true
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.challenge_id = challenges.id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users create own challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators update own challenges"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators delete own challenges"
  ON public.challenges FOR DELETE
  USING (auth.uid() = creator_id);

CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Participants policies
CREATE POLICY "View participants of accessible challenges"
  ON public.challenge_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_participants.challenge_id
        AND (c.is_public = true OR c.creator_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.challenge_participants cp2
                     WHERE cp2.challenge_id = c.id AND cp2.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users join challenges themselves"
  ON public.challenge_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users leave challenges themselves"
  ON public.challenge_participants FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System updates participant scores"
  ON public.challenge_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. Reactions on workout sessions
-- ============================================================
CREATE TYPE public.reaction_emoji AS ENUM ('flex', 'fire', 'clap');

CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  emoji public.reaction_emoji NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, from_user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_session ON public.reactions(session_id);
CREATE INDEX IF NOT EXISTS idx_reactions_from ON public.reactions(from_user_id);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view reactions on visible sessions"
  ON public.reactions FOR SELECT
  USING (
    from_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = reactions.session_id
        AND (ws.user_id = auth.uid() OR public.are_friends(auth.uid(), ws.user_id))
    )
  );

CREATE POLICY "Users react on friends' sessions"
  ON public.reactions FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = reactions.session_id
        AND (ws.user_id = auth.uid() OR public.are_friends(auth.uid(), ws.user_id))
    )
  );

CREATE POLICY "Users delete own reactions"
  ON public.reactions FOR DELETE
  USING (auth.uid() = from_user_id);

-- ============================================================
-- 6. RLS extension on workout_sessions: friends can view each other's
-- ============================================================
CREATE POLICY "Friends view each other's sessions"
  ON public.workout_sessions FOR SELECT
  USING (public.are_friends(auth.uid(), user_id));

-- ============================================================
-- 7. Award points on session completion
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_session_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_pts INTEGER := 10;
  vol_bonus INTEGER := 0;
BEGIN
  -- Only award when session transitions from unfinished -> finished
  IF NEW.finished_at IS NOT NULL
     AND (OLD.finished_at IS NULL OR OLD.finished_at IS DISTINCT FROM NEW.finished_at) THEN

    -- +1 point per 1000kg of volume (max +20)
    vol_bonus := LEAST(20, FLOOR(COALESCE(NEW.total_volume, 0) / 1000)::INT);

    UPDATE public.profiles
    SET total_points = total_points + base_pts + vol_bonus
    WHERE user_id = NEW.user_id;

    -- Update scores for active challenges the user joined
    UPDATE public.challenge_participants cp
    SET score = score + CASE c.type
      WHEN 'most_sessions' THEN 1
      WHEN 'most_volume' THEN COALESCE(NEW.total_volume, 0)
      WHEN 'most_frequency' THEN 1
    END
    FROM public.challenges c
    WHERE cp.challenge_id = c.id
      AND cp.user_id = NEW.user_id
      AND NEW.finished_at BETWEEN c.starts_at AND c.ends_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_session_points_trg ON public.workout_sessions;
CREATE TRIGGER award_session_points_trg
  AFTER UPDATE ON public.workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_session_points();

-- ============================================================
-- 8. Friend ranking helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_friend_ranking(_user_id UUID, _start TIMESTAMPTZ, _end TIMESTAMPTZ)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  sessions INTEGER,
  total_volume NUMERIC,
  points INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH friend_ids AS (
    SELECT _user_id AS uid
    UNION
    SELECT CASE WHEN requester_id = _user_id THEN addressee_id ELSE requester_id END
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = _user_id OR addressee_id = _user_id)
  ),
  sess AS (
    SELECT ws.user_id,
      COUNT(*)::INT AS sessions,
      COALESCE(SUM(ws.total_volume), 0)::NUMERIC AS total_volume
    FROM public.workout_sessions ws
    JOIN friend_ids f ON f.uid = ws.user_id
    WHERE ws.finished_at IS NOT NULL
      AND ws.finished_at BETWEEN _start AND _end
    GROUP BY ws.user_id
  )
  SELECT
    f.uid AS user_id,
    COALESCE(p.display_name, 'Atleta') AS display_name,
    COALESCE(s.sessions, 0) AS sessions,
    COALESCE(s.total_volume, 0) AS total_volume,
    (COALESCE(s.sessions, 0) * 10 + LEAST(20, FLOOR(COALESCE(s.total_volume, 0) / 1000)::INT)) AS points
  FROM friend_ids f
  LEFT JOIN public.profiles p ON p.user_id = f.uid
  LEFT JOIN sess s ON s.user_id = f.uid
  ORDER BY points DESC, sessions DESC;
$$;