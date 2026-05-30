// Stripe webhook → registra assinaturas e eventos de receita no Supabase.
//
// Eventos tratados:
//   checkout.session.completed        -> new
//   customer.subscription.created     -> new
//   customer.subscription.updated     -> upgrade/downgrade/renewal
//   customer.subscription.deleted     -> canceled
//   invoice.paid / invoice.payment_succeeded -> renewal
//
// Segurança: valida a assinatura `Stripe-Signature` com STRIPE_WEBHOOK_SECRET
// (HMAC-SHA256, esquema oficial t=...,v1=...). Sem SDK — Web Crypto puro.
//
// Variáveis de ambiente necessárias (supabase secrets set ...):
//   STRIPE_WEBHOOK_SECRET   whsec_...
//   SUPABASE_URL            (injetada automaticamente)
//   SUPABASE_SERVICE_ROLE_KEY (injetada automaticamente)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------- Verificação de assinatura Stripe ----------
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  // Header: "t=1492774577,v1=5257a8...,v0=..."
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string]),
  );
  const timestamp = parts["t"];
  const expected = parts["v1"];
  if (!timestamp || !expected) return false;

  // Rejeita eventos com mais de 5 min (proteção contra replay).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(age) || age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload)),
  );
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Mapeia o valor (centavos) para o código de plano do Fit Flow.
function planCodeFromAmount(amountCents: number, interval?: string): string {
  if (amountCents === 0) return "free";
  if (interval === "year" || amountCents >= 20000) return "annual";
  return "premium";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const sig = req.headers.get("Stripe-Signature");
  const raw = await req.text();

  if (!WEBHOOK_SECRET) return json({ error: "webhook secret não configurado" }, 500);
  if (!sig || !(await verifyStripeSignature(raw, sig, WEBHOOK_SECRET))) {
    return json({ error: "assinatura inválida" }, 400);
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "payload inválido" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const obj = event.data.object;

  try {
    // Resolve e-mail do cliente conforme o tipo de objeto.
    const email =
      (obj.customer_email as string) ||
      ((obj.customer_details as { email?: string })?.email) ||
      "";
    if (!email) return json({ ok: true, skipped: "sem e-mail do cliente" });

    const { data: userId } = await admin.rpc("admin_user_id_by_email", { _email: email });
    if (!userId) return json({ ok: true, skipped: "usuário não encontrado" });

    // Determina valor/intervalo/plano.
    const amount =
      (obj.amount_total as number) ??
      (obj.amount_paid as number) ??
      ((obj.items as { data?: { price?: { unit_amount?: number; recurring?: { interval?: string } } }[] })
        ?.data?.[0]?.price?.unit_amount) ??
      0;
    const interval =
      (obj.items as { data?: { price?: { recurring?: { interval?: string } } }[] })
        ?.data?.[0]?.price?.recurring?.interval;
    const planCode = planCodeFromAmount(amount, interval);

    const subId = (obj.subscription as string) || (obj.id as string);
    const custId = obj.customer as string;
    const periodEnd = obj.current_period_end
      ? new Date((obj.current_period_end as number) * 1000).toISOString()
      : null;

    // Mapeia o tipo de evento Stripe -> tipo interno.
    let eventType: string | null = null;
    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
        eventType = "new";
        break;
      case "customer.subscription.updated":
        eventType = (obj.cancel_at_period_end as boolean) ? "downgrade" : "renewal";
        break;
      case "customer.subscription.deleted":
        eventType = "canceled";
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        eventType = "renewal";
        break;
      default:
        return json({ ok: true, ignored: event.type });
    }

    await admin.rpc("apply_subscription_event", {
      _user_id: userId,
      _plan_code: planCode,
      _event_type: eventType,
      _gateway: "stripe",
      _amount_cents: amount,
      _gateway_sub_id: subId,
      _gateway_cust_id: custId,
      _period_end: periodEnd,
    });

    return json({ ok: true, type: event.type, eventType });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("stripe-webhook error", msg);
    return json({ error: msg }, 500);
  }
});
