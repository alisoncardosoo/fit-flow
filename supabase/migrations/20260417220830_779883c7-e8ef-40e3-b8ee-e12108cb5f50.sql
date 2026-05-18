-- Cache de insights gerados pela IA (TTL ~12h)
CREATE TABLE public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_insights"
ON public.ai_insights FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own ai_insights"
ON public.ai_insights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own ai_insights"
ON public.ai_insights FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_ai_insights_user_fresh
ON public.ai_insights (user_id, generated_at DESC);