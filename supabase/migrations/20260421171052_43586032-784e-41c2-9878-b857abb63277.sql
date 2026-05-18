-- Enable realtime for workout-related tables so the workouts list updates automatically
ALTER TABLE public.workouts REPLICA IDENTITY FULL;
ALTER TABLE public.routine_sheets REPLICA IDENTITY FULL;
ALTER TABLE public.workout_exercises REPLICA IDENTITY FULL;
ALTER TABLE public.workout_sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workouts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_sheets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_exercises;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;