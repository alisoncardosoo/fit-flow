-- =====================================================
-- FIT FLOW — Helpers para webhooks de pagamento (Stripe / Mercado Pago)
-- =====================================================
-- RPC SECURITY DEFINER chamada pelas Edge Functions (que usam service role)
-- para registrar/atualizar assinaturas e o histórico de eventos de forma
-- atômica e idempotente, a partir do user_id e do código do plano.
-- =====================================================

-- Resolve o user_id a partir do e-mail (gateways enviam e-mail do cliente).
CREATE OR REPLACE FUNCTION public.admin_user_id_by_email(_email TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;

-- Aplica um evento de assinatura vindo de um gateway.
--   _user_id        : usuário dono da assinatura
--   _plan_code      : free | premium | annual
--   _event_type     : new | renewal | upgrade | downgrade | canceled
--   _gateway        : stripe | mercadopago | manual
--   _amount_cents   : valor cobrado (centavos)
--   _gateway_sub_id : id da assinatura no gateway (para upsert idempotente)
--   _gateway_cust_id: id do cliente no gateway
--   _period_end     : fim do período atual (renovação)
-- Faz upsert na subscriptions e insere uma linha em subscription_events.
CREATE OR REPLACE FUNCTION public.apply_subscription_event(
  _user_id UUID,
  _plan_code TEXT,
  _event_type public.subscription_event_type,
  _gateway public.payment_gateway,
  _amount_cents INTEGER,
  _gateway_sub_id TEXT DEFAULT NULL,
  _gateway_cust_id TEXT DEFAULT NULL,
  _period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _plan_id UUID;
  _sub_id UUID;
  _new_status public.subscription_status;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;

  SELECT id INTO _plan_id FROM public.plans WHERE code = _plan_code;

  -- status derivado do tipo de evento
  _new_status := CASE
    WHEN _event_type = 'canceled' THEN 'canceled'
    ELSE 'active'
  END::public.subscription_status;

  -- Upsert da assinatura: tenta casar pelo id do gateway; senão, pelo usuário.
  IF _gateway_sub_id IS NOT NULL THEN
    SELECT id INTO _sub_id FROM public.subscriptions
    WHERE gateway_subscription_id = _gateway_sub_id LIMIT 1;
  END IF;

  IF _sub_id IS NULL THEN
    SELECT id INTO _sub_id FROM public.subscriptions
    WHERE user_id = _user_id AND gateway = _gateway
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF _sub_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id, plan_id, status, gateway, gateway_customer_id,
      gateway_subscription_id, amount_cents, current_period_end,
      canceled_at
    ) VALUES (
      _user_id, _plan_id, _new_status, _gateway, _gateway_cust_id,
      _gateway_sub_id, _amount_cents, _period_end,
      CASE WHEN _event_type = 'canceled' THEN now() ELSE NULL END
    )
    RETURNING id INTO _sub_id;
  ELSE
    UPDATE public.subscriptions SET
      plan_id = COALESCE(_plan_id, plan_id),
      status = _new_status,
      gateway = _gateway,
      gateway_customer_id = COALESCE(_gateway_cust_id, gateway_customer_id),
      gateway_subscription_id = COALESCE(_gateway_sub_id, gateway_subscription_id),
      amount_cents = _amount_cents,
      current_period_end = COALESCE(_period_end, current_period_end),
      canceled_at = CASE WHEN _event_type = 'canceled' THEN now() ELSE NULL END,
      updated_at = now()
    WHERE id = _sub_id;
  END IF;

  INSERT INTO public.subscription_events (
    subscription_id, user_id, event_type, amount_cents, gateway
  ) VALUES (
    _sub_id, _user_id, _event_type, _amount_cents, _gateway
  );

  RETURN _sub_id;
END;
$$;

-- Incrementa o uso de um cupom de forma atômica (usado em checkout).
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row public.coupons;
BEGIN
  SELECT * INTO _row FROM public.coupons
  WHERE upper(code) = upper(_code) AND active = true
  FOR UPDATE;

  IF _row.id IS NULL THEN RETURN false; END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN RETURN false; END IF;
  IF _row.max_uses > 0 AND _row.uses >= _row.max_uses THEN RETURN false; END IF;

  UPDATE public.coupons SET uses = uses + 1, updated_at = now() WHERE id = _row.id;
  RETURN true;
END;
$$;
