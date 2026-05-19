-- Sincronização diária do catálogo público de exercícios via Supabase Cron.
-- Estratégia: executar SQL local (sem chamada HTTP), evitando segredos em cron.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.sync_exercise_catalog_sql()
RETURNS TABLE(inserted_count integer, updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_updated integer := 0;
BEGIN
  WITH mapped AS (
    SELECT trim(m.exercise_name_pt) AS name, m.slug
    FROM public.exercise_image_map m
    WHERE trim(m.exercise_name_pt) <> ''
  ),
  dedup AS (
    SELECT DISTINCT ON (lower(name))
      name, slug
    FROM mapped
    ORDER BY lower(name), char_length(name) DESC
  ),
  ins AS (
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
      SELECT 1 FROM public.exercises e WHERE lower(e.name) = lower(d.name)
    )
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM ins;

  WITH upd AS (
    UPDATE public.exercises e
    SET image_url = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' || m.slug || '/0.jpg'
    FROM public.exercise_image_map m
    WHERE lower(e.name) = lower(m.exercise_name_pt)
      AND e.is_public = true
      AND (e.image_url IS NULL OR e.image_url LIKE '%supabase.co/storage%')
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_updated FROM upd;

  RETURN QUERY SELECT v_inserted, v_updated;
END;
$$;

-- Recria job de forma idempotente.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'daily-sync-exercise-catalog';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- 03:15 UTC diariamente
  PERFORM cron.schedule(
    'daily-sync-exercise-catalog',
    '15 3 * * *',
    $job$SELECT * FROM public.sync_exercise_catalog_sql();$job$
  );
END $$;
