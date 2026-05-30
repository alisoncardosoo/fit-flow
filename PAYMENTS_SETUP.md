# Integração de Pagamentos — Stripe & Mercado Pago

Os webhooks registram assinaturas e receita reais no Supabase. Quando um
pagamento acontece, a Edge Function correspondente grava em `subscriptions`
e `subscription_events`, e o painel `/admin` passa a exibir MRR, ARR, novas
assinaturas, cancelamentos, upgrades/downgrades e o gráfico de receita —
tudo automaticamente.

> Pré-requisito: a migração `20260530192244_payment_webhook_helpers.sql`
> precisa estar aplicada (cria as RPCs `apply_subscription_event`,
> `admin_user_id_by_email` e `redeem_coupon`). Rode `supabase db push`.

---

## 1. Deploy das funções

```bash
supabase functions deploy stripe-webhook
supabase functions deploy mercadopago-webhook
```

As URLs ficam:

- `https://ebnoiynvjpdcuomblwzv.functions.supabase.co/stripe-webhook`
- `https://ebnoiynvjpdcuomblwzv.functions.supabase.co/mercadopago-webhook`

> `verify_jwt = false` já está no `supabase/config.toml` — webhooks externos
> não enviam JWT do Supabase; a autenticidade é validada pela **assinatura**
> dentro de cada função.

---

## 2. Stripe

### 2.1 Criar o endpoint de webhook

No [Dashboard da Stripe](https://dashboard.stripe.com/webhooks) → **Add endpoint**:

- **URL:** a URL do `stripe-webhook` acima
- **Eventos:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`

### 2.2 Configurar o segredo

Copie o **Signing secret** (`whsec_...`) do endpoint e salve como secret:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

A função valida o header `Stripe-Signature` (HMAC-SHA256, com proteção de
replay de 5 min). Eventos sem assinatura válida são rejeitados com 400.

---

## 3. Mercado Pago

### 3.1 Configurar credenciais

```bash
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
supabase secrets set MERCADOPAGO_WEBHOOK_SECRET=xxx   # chave secreta do painel de webhooks
```

### 3.2 Criar a notificação de webhook

No [painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
→ **Webhooks** → configure a URL do `mercadopago-webhook` e selecione os
tópicos **Pagamentos** e **Assinaturas (preapproval)**.

O MP envia apenas o `id` do recurso; a função busca os detalhes na API do MP
com o `MERCADOPAGO_ACCESS_TOKEN` e valida o header `x-signature`.

---

## 4. Mapeamento de planos

O valor pago é mapeado para o código de plano do Fit Flow:

| Valor / intervalo            | Plano     |
|------------------------------|-----------|
| 0                            | `free`    |
| anual ou ≥ R$ 200,00         | `annual`  |
| demais valores recorrentes   | `premium` |

Ajuste a função `planCodeFromAmount` em cada webhook se seus preços diferirem,
ou troque para mapear pelo `price_id` (Stripe) / `preapproval_plan_id` (MP).

---

## 5. Testar

**Stripe:**
```bash
stripe trigger checkout.session.completed
# ou: stripe listen --forward-to <url-do-webhook>
```

**Mercado Pago:** use o botão "Simular notificação" no painel de webhooks.

Após um evento válido, confira em `/admin/subscriptions`:
- o gateway aparece como **"Recebendo eventos"**;
- a transação surge na tabela "Transações recentes";
- MRR/ARR e o gráfico de receita são recalculados.

---

## Como funciona por dentro

1. Webhook recebe o evento → **valida a assinatura**.
2. Resolve o `user_id` pelo e-mail do cliente (`admin_user_id_by_email`).
3. Chama `apply_subscription_event(...)`, que faz **upsert idempotente** em
   `subscriptions` (casando pelo id do gateway) e insere uma linha em
   `subscription_events` (histórico que alimenta os KPIs de receita).
4. O painel lê tudo via as RPCs de analytics já existentes.

A função `redeem_coupon(code)` também está disponível para incrementar o uso
de cupons de forma atômica no seu fluxo de checkout.
