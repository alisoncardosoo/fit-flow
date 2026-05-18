-- Coluna para guardar a URL da imagem do exercício
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url text;

-- Bucket público para imagens de exercícios
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
CREATE POLICY "Exercise images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise-images');

CREATE POLICY "Authenticated users can upload exercise images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exercise-images');

CREATE POLICY "Authenticated users can update exercise images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'exercise-images');