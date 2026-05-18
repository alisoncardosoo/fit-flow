ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_sets integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS default_reps integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_rest_seconds integer NOT NULL DEFAULT 60;