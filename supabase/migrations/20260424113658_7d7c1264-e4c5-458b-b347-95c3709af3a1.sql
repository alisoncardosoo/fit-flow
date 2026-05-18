-- 1) Tabela de overrides por usuário
CREATE TABLE IF NOT EXISTS public.exercise_image_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload', -- 'upload' | 'ai'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

ALTER TABLE public.exercise_image_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own image overrides"
  ON public.exercise_image_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own image overrides"
  ON public.exercise_image_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own image overrides"
  ON public.exercise_image_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own image overrides"
  ON public.exercise_image_overrides FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_exercise_image_overrides_updated_at
  BEFORE UPDATE ON public.exercise_image_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_exercise_image_overrides_user
  ON public.exercise_image_overrides(user_id);

-- 2) Policies de storage para o bucket existente "exercise-images"
-- O bucket já é público para leitura (SELECT). Adicionamos INSERT/UPDATE/DELETE
-- restritos a arquivos sob a pasta {user_id}/...
CREATE POLICY "Users upload own exercise images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own exercise images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own exercise images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );