-- Seed inicial do catálogo público de exercícios a partir do mapeamento de imagens.
-- Objetivo: garantir biblioteca não-vazia em ambientes novos.
WITH mapped AS (
  SELECT
    trim(m.exercise_name_pt) AS name,
    m.slug
  FROM public.exercise_image_map m
  WHERE trim(m.exercise_name_pt) <> ''
),
dedup AS (
  SELECT DISTINCT ON (lower(name))
    name,
    slug
  FROM mapped
  ORDER BY lower(name), char_length(name) DESC
)
INSERT INTO public.exercises (
  name,
  muscle_group,
  equipment,
  difficulty,
  is_public,
  user_id,
  description,
  image_url
)
SELECT
  d.name,
  'full_body'::public.muscle_group,
  'other'::public.equipment_type,
  'intermediate'::public.difficulty_level,
  true,
  NULL,
  'Exercício do catálogo público FitFlow',
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' || d.slug || '/0.jpg'
FROM dedup d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.exercises e
  WHERE lower(e.name) = lower(d.name)
);

-- Reforça o vínculo da imagem para exercícios públicos já existentes mapeados.
UPDATE public.exercises e
SET image_url = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' || m.slug || '/0.jpg'
FROM public.exercise_image_map m
WHERE lower(e.name) = lower(m.exercise_name_pt)
  AND e.is_public = true
  AND (e.image_url IS NULL OR e.image_url LIKE '%supabase.co/storage%');
