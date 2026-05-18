-- Monthly goals: one row per user per month
CREATE TABLE public.monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_sessions INTEGER NOT NULL DEFAULT 12,
  target_volume NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own goals" ON public.monthly_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own goals" ON public.monthly_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals" ON public.monthly_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own goals" ON public.monthly_goals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_monthly_goals_updated_at
BEFORE UPDATE ON public.monthly_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Achievements (badges) earned by users
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  tier TEXT NOT NULL DEFAULT 'bronze',
  metadata JSONB DEFAULT '{}'::jsonb,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own achievements" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own achievements" ON public.achievements FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_achievements_user ON public.achievements (user_id, earned_at DESC);
CREATE INDEX idx_monthly_goals_user_period ON public.monthly_goals (user_id, year DESC, month DESC);

-- Helper: monthly progress
CREATE OR REPLACE FUNCTION public.get_monthly_progress(_user_id UUID, _year INT, _month INT)
RETURNS TABLE (sessions_count INT, total_volume NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COUNT(*)::INT,
    COALESCE(SUM(total_volume), 0)::NUMERIC
  FROM public.workout_sessions
  WHERE user_id = _user_id
    AND finished_at IS NOT NULL
    AND EXTRACT(YEAR FROM started_at) = _year
    AND EXTRACT(MONTH FROM started_at) = _month;
$$;

-- Helper: total finished sessions
CREATE OR REPLACE FUNCTION public.get_total_sessions(_user_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.workout_sessions
  WHERE user_id = _user_id AND finished_at IS NOT NULL;
$$;

-- Helper: best weight per exercise (for PR badges)
CREATE OR REPLACE FUNCTION public.get_exercise_pr(_user_id UUID, _exercise_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(MAX(weight), 0)::NUMERIC FROM public.set_logs
  WHERE user_id = _user_id AND exercise_id = _exercise_id AND reps >= 1;
$$;