-- Backfill: for any workout that has exercises without a sheet, create a default sheet "A" and link them
DO $$
DECLARE
  w RECORD;
  new_sheet_id UUID;
BEGIN
  FOR w IN
    SELECT DISTINCT we.workout_id
    FROM public.workout_exercises we
    WHERE we.sheet_id IS NULL
  LOOP
    -- Reuse an existing sheet if there is already one in the workout
    SELECT id INTO new_sheet_id
    FROM public.routine_sheets
    WHERE workout_id = w.workout_id
    ORDER BY position ASC
    LIMIT 1;

    IF new_sheet_id IS NULL THEN
      INSERT INTO public.routine_sheets (workout_id, name, position)
      VALUES (w.workout_id, 'A', 0)
      RETURNING id INTO new_sheet_id;
    END IF;

    UPDATE public.workout_exercises
    SET sheet_id = new_sheet_id
    WHERE workout_id = w.workout_id AND sheet_id IS NULL;
  END LOOP;
END $$;