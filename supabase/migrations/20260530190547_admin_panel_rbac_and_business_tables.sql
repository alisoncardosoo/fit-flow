-- =====================================================
-- FIT FLOW — Painel administrativo: RBAC + tabelas de negócio + RPCs
-- =====================================================
-- Esta migração habilita o painel /admin com DADOS REAIS:
--   1. RBAC (Role Based Access Control) via tabela user_roles + has_role()
--   2. Políticas RLS que dão acesso de leitura/escrita a admins
--   3. Tabelas de negócio que ainda não existiam (planos, assinaturas,
--      cupons, tickets, campanhas de notificação, settings)
--   4. RPCs SECURITY DEFINER com agregações para os dashboards/analytics
--
-- IMPORTANTE: depois de aplicar, crie o usuário admin e atribua o papel
-- (ver instruções no final do arquivo / ADMIN_SETUP.md).
-- =====================================================

-- =====================================================
-- 1. RBAC — papéis de aplicação
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'editor', 'support');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role: função SECURITY DEFINER evita recursão de RLS (não consulta
-- a própria tabela sob a policy do usuário).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- is_admin: qualquer papel administrativo (super_admin ou admin).
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin')
  );
$$;

-- is_staff: qualquer papel do painel (inclui editor e support).
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  );
$$;

-- Papéis: usuário vê os próprios; admins veem/gerenciam todos.
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- get_my_roles: usado pelo frontend para descobrir os papéis do admin logado.
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS public.app_role[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::public.app_role[])
  FROM public.user_roles
  WHERE user_id = auth.uid();
$$;

-- =====================================================
-- 2. Políticas RLS de leitura para admins nas tabelas existentes
-- =====================================================
-- Damos a admins/staff acesso de leitura à base, mantendo as policies
-- de usuário intactas (que continuam com auth.uid() = user_id).

CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins read all workouts" ON public.workouts FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins read all sessions" ON public.workout_sessions FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins read all set_logs" ON public.set_logs FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage exercises" ON public.exercises FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- 3. Tabelas de negócio
-- =====================================================

-- ---- Planos ----------------------------------------
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,            -- free | premium | annual
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month', -- month | year | none
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active plans" ON public.plans FOR SELECT
  USING (active = true OR public.is_staff(auth.uid()));
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Assinaturas -----------------------------------
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled');
CREATE TYPE public.payment_gateway AS ENUM ('stripe', 'mercadopago', 'manual');

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'active',
  gateway public.payment_gateway NOT NULL DEFAULT 'manual',
  gateway_customer_id TEXT,
  gateway_subscription_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Eventos de assinatura (histórico p/ MRR, churn, upgrades) ----
CREATE TYPE public.subscription_event_type AS ENUM ('new', 'renewal', 'upgrade', 'downgrade', 'canceled');

CREATE TABLE public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.subscription_event_type NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  gateway public.payment_gateway NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_events_created ON public.subscription_events(created_at DESC);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read subscription events" ON public.subscription_events FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage subscription events" ON public.subscription_events FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Cupons ----------------------------------------
CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed', 'trial');

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type public.coupon_type NOT NULL DEFAULT 'percent',
  value NUMERIC(10,2) NOT NULL DEFAULT 0,  -- % | reais | dias (trial)
  plan_code TEXT,                          -- plano aplicável (null = todos)
  max_uses INTEGER NOT NULL DEFAULT 0,     -- 0 = ilimitado
  uses INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read coupons" ON public.coupons FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Tickets de suporte ----------------------------
CREATE TYPE public.ticket_status AS ENUM ('open', 'pending', 'resolved');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.ticket_channel AS ENUM ('email', 'chat', 'app');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  channel public.ticket_channel NOT NULL DEFAULT 'app',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
-- Usuário pode abrir e ver os próprios tickets; staff gerencia todos.
CREATE POLICY "Users view own tickets" ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Users create own tickets" ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage tickets" ON public.support_tickets FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ---- Campanhas de notificação ----------------------
CREATE TYPE public.campaign_channel AS ENUM ('push', 'email', 'in_app');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'sent');

CREATE TABLE public.notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  channel public.campaign_channel NOT NULL DEFAULT 'push',
  audience TEXT NOT NULL DEFAULT 'all',   -- all | active | inactive | free | premium | risk
  status public.campaign_status NOT NULL DEFAULT 'sent',
  reach INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_created ON public.notification_campaigns(created_at DESC);
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read campaigns" ON public.notification_campaigns FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage campaigns" ON public.notification_campaigns FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Configurações da plataforma -------------------
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read settings" ON public.app_settings FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- updated_at triggers
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. RPCs de analytics (todas SECURITY DEFINER + checagem de staff)
-- =====================================================

-- KPIs principais do dashboard.
CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_users INTEGER;
  active_users INTEGER;
  new_today INTEGER;
  active_subs INTEGER;
  mrr_cents BIGINT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT count(*) INTO total_users FROM auth.users;

  -- ativos: sessão finalizada nos últimos 30 dias
  SELECT count(DISTINCT user_id) INTO active_users
  FROM public.workout_sessions
  WHERE finished_at IS NOT NULL AND started_at >= now() - INTERVAL '30 days';

  SELECT count(*) INTO new_today FROM auth.users
  WHERE created_at >= date_trunc('day', now());

  SELECT count(*) INTO active_subs FROM public.subscriptions
  WHERE status IN ('active', 'trialing');

  SELECT COALESCE(sum(amount_cents), 0) INTO mrr_cents FROM public.subscriptions
  WHERE status = 'active';

  result := jsonb_build_object(
    'total_users', total_users,
    'active_users', active_users,
    'new_today', new_today,
    'active_subscribers', active_subs,
    'mrr_cents', mrr_cents,
    'arr_cents', mrr_cents * 12
  );
  RETURN result;
END;
$$;

-- Série de novos usuários por dia (default 30 dias).
CREATE OR REPLACE FUNCTION public.admin_user_growth(_days INTEGER DEFAULT 30)
RETURNS TABLE (day DATE, novos BIGINT, total BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      date_trunc('day', now()) - ((_days - 1) || ' days')::interval,
      date_trunc('day', now()),
      '1 day'
    )::date AS day
  ),
  daily AS (
    SELECT date_trunc('day', created_at)::date AS day, count(*) AS novos
    FROM auth.users GROUP BY 1
  )
  SELECT d.day,
         COALESCE(x.novos, 0) AS novos,
         (SELECT count(*) FROM auth.users u WHERE u.created_at < d.day + INTERVAL '1 day') AS total
  FROM days d
  LEFT JOIN daily x ON x.day = d.day
  ORDER BY d.day;
END;
$$;

-- Receita mensal (últimos N meses) a partir de subscription_events.
CREATE OR REPLACE FUNCTION public.admin_revenue_monthly(_months INTEGER DEFAULT 12)
RETURNS TABLE (month DATE, revenue_cents BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - ((_months - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'
    )::date AS month
  ),
  agg AS (
    SELECT date_trunc('month', created_at)::date AS month, sum(amount_cents) AS revenue_cents
    FROM public.subscription_events
    WHERE event_type IN ('new', 'renewal', 'upgrade')
    GROUP BY 1
  )
  SELECT m.month, COALESCE(a.revenue_cents, 0)::BIGINT
  FROM months m LEFT JOIN agg a ON a.month = m.month
  ORDER BY m.month;
END;
$$;

-- Distribuição de planos (donut).
CREATE OR REPLACE FUNCTION public.admin_plan_distribution()
RETURNS TABLE (plan_code TEXT, plan_name TEXT, total BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT p.code, p.name, count(s.id) AS total
  FROM public.plans p
  LEFT JOIN public.subscriptions s
    ON s.plan_id = p.id AND s.status IN ('active', 'trialing')
  GROUP BY p.code, p.name, p.price_cents
  ORDER BY p.price_cents;
END;
$$;

-- Heatmap de engajamento (dia da semana x hora) com base nas sessões.
CREATE OR REPLACE FUNCTION public.admin_engagement_heatmap(_days INTEGER DEFAULT 90)
RETURNS TABLE (dow INTEGER, hour INTEGER, sessions BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT EXTRACT(DOW FROM started_at)::INTEGER AS dow,
         EXTRACT(HOUR FROM started_at)::INTEGER AS hour,
         count(*) AS sessions
  FROM public.workout_sessions
  WHERE started_at >= now() - (_days || ' days')::interval
  GROUP BY 1, 2;
END;
$$;

-- Usuários em risco (buckets de inatividade) — contagem.
CREATE OR REPLACE FUNCTION public.admin_at_risk_counts()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH last_seen AS (
    SELECT u.id AS user_id,
           GREATEST(
             COALESCE(max(s.started_at), u.created_at),
             u.created_at
           ) AS seen
    FROM auth.users u
    LEFT JOIN public.workout_sessions s ON s.user_id = u.id
    GROUP BY u.id, u.created_at
  ),
  buckets AS (
    SELECT
      count(*) FILTER (WHERE now() - seen BETWEEN INTERVAL '3 days' AND INTERVAL '7 days') AS d3,
      count(*) FILTER (WHERE now() - seen BETWEEN INTERVAL '7 days' AND INTERVAL '15 days') AS d7,
      count(*) FILTER (WHERE now() - seen BETWEEN INTERVAL '15 days' AND INTERVAL '30 days') AS d15,
      count(*) FILTER (WHERE now() - seen >= INTERVAL '30 days') AS d30
    FROM last_seen
  )
  SELECT jsonb_build_object('d3', d3, 'd7', d7, 'd15', d15, 'd30', d30)
  INTO result FROM buckets;
  RETURN result;
END;
$$;

-- Streaks: quantos usuários têm streak >= 7/15/30/90.
CREATE OR REPLACE FUNCTION public.admin_streak_buckets()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH streaks AS (
    SELECT public.get_user_streak(u.id) AS s FROM auth.users u
  )
  SELECT jsonb_build_object(
    's7', count(*) FILTER (WHERE s >= 7),
    's15', count(*) FILTER (WHERE s >= 15),
    's30', count(*) FILTER (WHERE s >= 30),
    's90', count(*) FILTER (WHERE s >= 90)
  ) INTO result FROM streaks;
  RETURN result;
END;
$$;

-- Lista de usuários para o painel (com último acesso + plano).
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search TEXT DEFAULT NULL,
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  username TEXT,
  goal TEXT,
  plan_code TEXT,
  subscription_status TEXT,
  created_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  total_sessions BIGINT,
  streak INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    p.display_name,
    p.username,
    p.goal::TEXT,
    COALESCE(pl.code, 'free') AS plan_code,
    COALESCE(s.status::TEXT, 'active') AS subscription_status,
    u.created_at,
    GREATEST(COALESCE(max(ws.started_at), u.created_at), u.created_at) AS last_seen,
    count(ws.id) AS total_sessions,
    public.get_user_streak(u.id) AS streak
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id AND s.status IN ('active','trialing')
  LEFT JOIN public.plans pl ON pl.id = s.plan_id
  LEFT JOIN public.workout_sessions ws ON ws.user_id = u.id
  WHERE _search IS NULL
     OR u.email ILIKE '%' || _search || '%'
     OR p.display_name ILIKE '%' || _search || '%'
     OR p.username ILIKE '%' || _search || '%'
  GROUP BY u.id, u.email, p.display_name, p.username, p.goal, pl.code, s.status, u.created_at
  ORDER BY u.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

-- Analytics de treinos/exercícios.
CREATE OR REPLACE FUNCTION public.admin_workout_analytics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result JSONB;
  started INTEGER;
  finished INTEGER;
  avg_min NUMERIC;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT count(*) INTO started FROM public.workout_sessions
  WHERE started_at >= now() - INTERVAL '30 days';
  SELECT count(*) INTO finished FROM public.workout_sessions
  WHERE finished_at IS NOT NULL AND started_at >= now() - INTERVAL '30 days';
  SELECT COALESCE(avg(duration_seconds), 0) / 60.0 INTO avg_min FROM public.workout_sessions
  WHERE finished_at IS NOT NULL AND started_at >= now() - INTERVAL '30 days';

  result := jsonb_build_object(
    'started', started,
    'finished', finished,
    'avg_minutes', round(avg_min, 1)
  );
  RETURN result;
END;
$$;

-- Exercícios mais/menos usados (por set_logs).
CREATE OR REPLACE FUNCTION public.admin_exercise_usage(_limit INTEGER DEFAULT 5, _asc BOOLEAN DEFAULT false)
RETURNS TABLE (exercise_id UUID, name TEXT, muscle_group TEXT, uses BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT e.id, e.name, e.muscle_group::TEXT, count(sl.id) AS uses
  FROM public.exercises e
  LEFT JOIN public.set_logs sl ON sl.exercise_id = e.id
  WHERE e.is_public = true
  GROUP BY e.id, e.name, e.muscle_group
  ORDER BY (CASE WHEN _asc THEN count(sl.id) END) ASC NULLS FIRST,
           (CASE WHEN NOT _asc THEN count(sl.id) END) DESC NULLS LAST
  LIMIT _limit;
END;
$$;

-- Métricas de treinos (alunos usando / conclusões) para o módulo Treinos.
CREATE OR REPLACE FUNCTION public.admin_workout_metrics()
RETURNS TABLE (
  workout_id UUID,
  name TEXT,
  archived BOOLEAN,
  updated_at TIMESTAMPTZ,
  athletes BIGINT,
  completions BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT w.id, w.name, w.archived, w.updated_at,
         count(DISTINCT ws.user_id) AS athletes,
         count(ws.id) FILTER (WHERE ws.finished_at IS NOT NULL) AS completions
  FROM public.workouts w
  LEFT JOIN public.workout_sessions ws ON ws.workout_id = w.id
  GROUP BY w.id, w.name, w.archived, w.updated_at
  ORDER BY athletes DESC
  LIMIT 60;
END;
$$;

-- =====================================================
-- 5. Seed de planos base (necessário para distribuição/assinaturas)
-- =====================================================
INSERT INTO public.plans (code, name, price_cents, interval) VALUES
  ('free', 'Gratuito', 0, 'none'),
  ('premium', 'Premium', 2990, 'month'),
  ('annual', 'Anual', 24900, 'year')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- INSTRUÇÕES PÓS-MIGRAÇÃO (criar admin)
-- =====================================================
-- 1) Crie o usuário no Supabase Auth (Dashboard > Authentication > Add user):
--      email: admin@fitflow.com.br   senha: #Teste123   (Auto Confirm: ON)
-- 2) Atribua o papel super_admin (SQL Editor):
--      INSERT INTO public.user_roles (user_id, role)
--      SELECT id, 'super_admin' FROM auth.users WHERE email = 'admin@fitflow.com.br';
-- Pronto: faça login em /admin/login com essas credenciais.
