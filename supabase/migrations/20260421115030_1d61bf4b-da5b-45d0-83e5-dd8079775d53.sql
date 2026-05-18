-- 1) Tabela de medidas corporais (peso, gordura opcional)
CREATE TABLE public.body_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  weight numeric NOT NULL,
  body_fat numeric NULL,
  notes text NULL,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_measurements_user_date_unique UNIQUE (user_id, measured_at)
);

CREATE INDEX idx_body_measurements_user_date
  ON public.body_measurements (user_id, measured_at DESC);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own measurements"
  ON public.body_measurements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own measurements"
  ON public.body_measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own measurements"
  ON public.body_measurements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own measurements"
  ON public.body_measurements FOR DELETE
  USING (auth.uid() = user_id);

-- 2) Override manual de progresso para metas custom
ALTER TABLE public.goals
  ADD COLUMN current_override numeric NULL;