-- 1) Tabela de fichas (rotinas dentro de um treino)
CREATE TABLE public.routine_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routine_sheets_workout ON public.routine_sheets(workout_id, position);

ALTER TABLE public.routine_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view sheets of own workouts"
ON public.routine_sheets FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = routine_sheets.workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users create sheets in own workouts"
ON public.routine_sheets FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = routine_sheets.workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users update sheets of own workouts"
ON public.routine_sheets FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = routine_sheets.workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users delete sheets of own workouts"
ON public.routine_sheets FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = routine_sheets.workout_id AND w.user_id = auth.uid()));

CREATE TRIGGER trg_routine_sheets_updated
BEFORE UPDATE ON public.routine_sheets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Adicionar sheet_id em workout_exercises (nullable, será preenchido pela migração)
ALTER TABLE public.workout_exercises
  ADD COLUMN sheet_id UUID REFERENCES public.routine_sheets(id) ON DELETE CASCADE;

CREATE INDEX idx_workout_exercises_sheet ON public.workout_exercises(sheet_id, position);

-- 3) Adicionar sheet_id em workout_sessions e last_sheet_id em workouts
ALTER TABLE public.workout_sessions
  ADD COLUMN sheet_id UUID REFERENCES public.routine_sheets(id) ON DELETE SET NULL;

ALTER TABLE public.workouts
  ADD COLUMN last_sheet_id UUID REFERENCES public.routine_sheets(id) ON DELETE SET NULL;

-- 4) MIGRAÇÃO DE DADOS: cada workout existente ganha uma ficha "A" com seus exercícios
DO $$
DECLARE
  w RECORD;
  new_sheet_id UUID;
BEGIN
  FOR w IN SELECT id FROM public.workouts LOOP
    INSERT INTO public.routine_sheets (workout_id, name, position)
    VALUES (w.id, 'A', 0)
    RETURNING id INTO new_sheet_id;

    UPDATE public.workout_exercises
    SET sheet_id = new_sheet_id
    WHERE workout_id = w.id AND sheet_id IS NULL;
  END LOOP;
END $$;

-- 5) Atualizar políticas de workout_exercises para considerar sheet_id também
DROP POLICY IF EXISTS "Users view own workout_exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users insert own workout_exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users update own workout_exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users delete own workout_exercises" ON public.workout_exercises;

CREATE POLICY "Users view own workout_exercises"
ON public.workout_exercises FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_exercises.workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users insert own workout_exercises"
ON public.workout_exercises FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_exercises.workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users update own workout_exercises"
ON public.workout_exercises FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_exercises.workout_id AND w.user_id = auth.uid()));

CREATE POLICY "Users delete own workout_exercises"
ON public.workout_exercises FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_exercises.workout_id AND w.user_id = auth.uid()));

-- 6) Trigger: ao iniciar sessão com sheet_id, atualiza last_sheet_id no workout
CREATE OR REPLACE FUNCTION public.update_workout_last_sheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sheet_id IS NOT NULL AND NEW.workout_id IS NOT NULL THEN
    UPDATE public.workouts
    SET last_sheet_id = NEW.sheet_id, updated_at = now()
    WHERE id = NEW.workout_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_update_last_sheet
AFTER INSERT ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_workout_last_sheet();