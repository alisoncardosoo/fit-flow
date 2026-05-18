-- Enum para tipo de meta
CREATE TYPE public.goal_type AS ENUM ('bodyweight', 'exercise_load', 'weekly_frequency', 'monthly_frequency', 'custom');

CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.goal_type NOT NULL,
  title TEXT NOT NULL,
  exercise_id UUID NULL REFERENCES public.exercises(id) ON DELETE SET NULL,
  start_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  deadline DATE NULL,
  achieved_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user ON public.goals(user_id);
CREATE INDEX idx_goals_user_active ON public.goals(user_id) WHERE achieved_at IS NULL;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own goals_v2"
  ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own goals_v2"
  ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals_v2"
  ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own goals_v2"
  ON public.goals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();