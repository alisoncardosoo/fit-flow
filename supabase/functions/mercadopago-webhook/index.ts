// Mercado Pago webhook → registra assinaturas e eventos de receita.
//
// O MP envia uma notificação leve (apenas tipo + id). Buscamos os detalhes
// na API do MP usando MERCADOPAGO_ACCESS_TOKEN e então registramos o evento.
//
// Tipos tratados:
//   payment            -> consulta /v1/payments/{id}      (new/renewal)
//   subscription_preapproval / preapproval -> consulta /preapproval/{id} (new/canceled)
//
// Segurança: valida a assinatura `x-signature` (HMAC-SHA256) com
// MERCADOPAGO_WEBHOOK_SECRET, conforme o manifesto id;request-id;ts.
//
// Variáveis de ambiente (supabase secrets set ...):
//   MERCADOPAGO_ACCESS_TOKEN     APP_USR-...
//   MERCADOPAGO_WEBHOOK_SECRET   (chave secreta do painel de webhooks do MP)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injetadas automaticamente)
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
const MP_SECRET = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------- Verificação de assinatura MP ----------
// x-signature: "ts=1700000000,v1=hexhmac"
// manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
async function verifyMpSignature(
  dataId: string,
  requestId: string | null,
  sigHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  let manifest = `id:${dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, v1);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function planCodeFromAmount(amountCents: number, isAnnual: boolean): string {
  if (amountCents === 0) return "free";
  if (isAnnual || amountCents >= 20000) return "annual";
  return "premium";
}

async function mpFetch(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!res.ok) {
    console.error("MP API error", path, res.status);
    return null;
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  if (!MP_TOKEN) return json({ error: "access token não configurado" }, 500);

  const url = new URL(req.url);
  const raw = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch { /* MP às vezes manda via query string */ }

  // id e tipo podem vir no corpo ou na query (?type=payment&data.id=123)
  const type = (body.type as string) || url.searchParams.get("type") || (body.topic as string) || "";
  const dataId =
    ((body.data as { id?: string })?.id) ||
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";

  if (!dataId) return json({ ok: true, skipped: "sem id" });

  // Valida assinatura quando o segredo está configurado.
  if (MP_SECRET) {
    const ok = await verifyMpSignature(
      dataId,
      req.headers.get("x-request-id"),
      req.headers.get("x-signature"),
      MP_SECRET,
    );
    if (!ok) return json({ error: "assinatura inválida" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    let email = "";
    let amountCents = 0;
    let isAnnual = false;
    let eventType: string | null = null;
    let gatewaySubId: string | null = null;
    let gatewayCustId: string | null = null;

    if (type === "payment") {
      const pay = await mpFetch(`/v1/payments/${dataId}`);
      if (!pay) return json({ ok: true, skipped: "pagamento não encontrado" });
      if (pay.status !== "approved") return json({ ok: true, ignored: `status ${pay.status}` });

      email = (pay.payer as { email?: string })?.email ?? "";
      amountCents = Math.round(((pay.transaction_amount as number) ?? 0) * 100);
      gatewaySubId = (pay.metadata as { subscription_id?: string })?.subscription_id ?? String(dataId);
      gatewayCustId = String((pay.payer as { id?: string })?.id ?? "");
      eventType = "renewal";
    } else if (type === "subscription_preapproval" || type === "preapproval" || type === "subscription") {
      const pre = await mpFetch(`/preapproval/${dataId}`);
      if (!pre) return json({ ok: true, skipped: "assinatura não encontrada" });

      email = (pre.payer_email as string) ?? "";
      const auto = pre.auto_recurring as { transaction_amount?: number; frequency_type?: string } | undefined;
      amountCents = Math.round((auto?.transaction_amount ?? 0) * 100);
      isAnnual = auto?.frequency_type === "years";
      gatewaySubId = String(dataId);
      gatewayCustId = String((pre.payer_id as string) ?? "");

      const status = pre.status as string;
      eventType = status === "cancelled" ? "canceled" : status === "authorized" ? "new" : "renewal";
    } else {
      return json({ ok: true, ignored: type });
    }

    if (!email) return json({ ok: true, skipped: "sem e-mail do cliente" });

    const { data: userId } = await admin.rpc("admin_user_id_by_email", { _email: email });
    if (!userId) return json({ ok: true, skipped: "usuário não encontrado" });

    await admin.rpc("apply_subscription_event", {
      _user_id: userId,
      _plan_code: planCodeFromAmount(amountCents, isAnnual),
      _event_type: eventType,
      _gateway: "mercadopago",
      _amount_cents: amountCents,
      _gateway_sub_id: gatewaySubId,
      _gateway_cust_id: gatewayCustId,
      _period_end: null,
    });

    return json({ ok: true, type, eventType });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("mercadopago-webhook error", msg);
    return json({ error: msg }, 500);
  }
});
