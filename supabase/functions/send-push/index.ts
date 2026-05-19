// Web Push sender — reads a notification row and fans out to all push_subscriptions
// of the recipient. Reuses the title/body that the DB triggers already built
// (which include the @username via public_handle()).
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@fitflow.app";

// ---------- base64url helpers ----------
function b64uToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ---------- VAPID JWT (ES256) ----------
async function importVapidPrivateKey(): Promise<CryptoKey> {
  const d = b64uToBytes(VAPID_PRIVATE_KEY);
  // Recover x,y from public key (uncompressed: 0x04 || X(32) || Y(32))
  const pub = b64uToBytes(VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("Invalid VAPID public key");
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: bytesToB64u(d),
    x: bytesToB64u(x),
    y: bytesToB64u(y),
    ext: true,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header = bytesToB64u(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const payload = bytesToB64u(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: VAPID_SUBJECT,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const key = await importVapidPrivateKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  return `${unsigned}.${bytesToB64u(sig)}`;
}

// ---------- Payload encryption (RFC 8291 / aes128gcm) ----------
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  payload: Uint8Array,
  uaPublicB64u: string,
  authSecretB64u: string,
): Promise<{ body: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  const uaPublic = b64uToBytes(uaPublicB64u);
  const authSecret = b64uToBytes(authSecretB64u);

  // Generate ephemeral server key pair
  const serverKp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublicJwk = await crypto.subtle.exportKey("jwk", serverKp.publicKey);
  const serverPublic = concat(
    new Uint8Array([0x04]),
    b64uToBytes(serverPublicJwk.x!),
    b64uToBytes(serverPublicJwk.y!),
  );

  // Import UA public key (uncompressed)
  const uaJwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64u(uaPublic.slice(1, 33)),
    y: bytesToB64u(uaPublic.slice(33, 65)),
    ext: true,
  };
  const uaKey = await crypto.subtle.importKey(
    "jwk",
    uaJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaKey },
    serverKp.privateKey,
    256,
  );
  const ecdh = new Uint8Array(sharedBits);

  // PRK_key = HKDF(authSecret, ECDH, "WebPush: info\0" || uaPublic || serverPublic, 32)
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    uaPublic,
    serverPublic,
  );
  const prkKey = await hkdf(authSecret, ecdh, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  // CEK
  const cek = await hkdf(
    salt,
    prkKey,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  // Nonce
  const nonce = await hkdf(
    salt,
    prkKey,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  // Plaintext + 0x02 padding delimiter (single record)
  const plain = concat(payload, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plain),
  );

  // Build aes128gcm header: salt(16) || rs(4 BE = 4096) || idlen(1) || keyid(serverPublic 65)
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  const idlen = new Uint8Array([serverPublic.length]);
  const body = concat(salt, rs, idlen, serverPublic, ciphertext);

  return { body, serverPublicKey: serverPublic, salt };
}

// ---------- Send to a single subscription ----------
async function sendOne(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: Uint8Array,
): Promise<number> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);

  const { body } = await encryptPayload(payload, p256dh, auth);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.length),
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    },
    body,
  });
  return res.status;
}

// ---------- Edge entrypoint ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { notification_id } = await req.json();
    if (!notification_id) {
      return new Response(JSON.stringify({ error: "notification_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: notif, error: notifErr } = await admin
      .from("notifications")
      .select("id, user_id, type, title, body, payload")
      .eq("id", notification_id)
      .maybeSingle();
    if (notifErr || !notif) {
      return new Response(JSON.stringify({ error: "notification not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notif.user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract @handle from title or body so the SW can render it nicely.
    const haystack = `${notif.title ?? ""} ${notif.body ?? ""}`;
    const handleMatch = haystack.match(/@[a-z0-9_.]{3,30}/i);
    const handle = handleMatch ? handleMatch[0] : null;

    const payload = new TextEncoder().encode(
      JSON.stringify({
        title: notif.title,
        body: notif.body ?? "",
        type: notif.type,
        payload: notif.payload ?? {},
        notification_id: notif.id,
        handle,
      }),
    );

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          const status = await sendOne(s.endpoint, s.p256dh, s.auth, payload);
          if (status === 404 || status === 410) stale.push(s.id);
          else if (status >= 200 && status < 300) sent++;
        } catch (e) {
          console.error("push send failed", s.id, e);
        }
      }),
    );

    if (stale.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ ok: true, sent, removed: stale.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-push error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
