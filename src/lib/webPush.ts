import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/native";

// Public VAPID key — safe to ship to the client (it's the *public* half).
export const VAPID_PUBLIC_KEY =
  "BBJQFV3LIgt1dMhszzEhJxCFzVZTi5Q9tcoMCtsJSRJayVDYcyIpeihMg1y83mstcNrvt9XfjjSrVYnUReIN8oM";

const SW_URL = "/sw-push.js";

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToB64u(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isPushSupported(): boolean {
  // No app nativo o push é sempre suportado (APNs/FCM via Capacitor).
  if (isNativePlatform()) return true;
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Avoid registering SW inside known preview iframes. */
function isPreviewContext(): boolean {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreview = host.includes("id-preview--");
    return inIframe || isPreview;
  } catch {
    return true;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (e) {
    console.error("SW registration failed", e);
    return null;
  }
}

export type PushStatus = "unsupported" | "blocked" | "denied" | "subscribed" | "idle";

export async function getPushStatus(userId: string): Promise<PushStatus> {
  if (isNativePlatform()) {
    const { getNativePushStatus } = await import("@/lib/nativePush");
    return getNativePushStatus(userId);
  }
  if (!isPushSupported()) return "unsupported";
  const perm = Notification.permission;
  if (perm === "denied") return "denied";

  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    // Confirm we have it stored on the server too
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("endpoint", sub.endpoint)
      .maybeSingle();
    if (data) return "subscribed";
  }
  return "idle";
}

export async function enablePush(userId: string): Promise<PushStatus> {
  if (isNativePlatform()) {
    const { enableNativePush } = await import("@/lib/nativePush");
    return enableNativePush(userId);
  }
  if (!isPushSupported()) return "unsupported";
  if (isPreviewContext()) {
    // Allow trying anyway, but warn — service workers behave oddly in iframes.
    console.warn("[push] preview/iframe context — enabling may not work");
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "blocked";

  const reg = await getRegistration();
  if (!reg) return "blocked";

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const appKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
    // Some TS lib targets type applicationServerKey as BufferSource | string;
    // pass the underlying ArrayBuffer slice to satisfy strict typings.
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey.buffer.slice(
        appKey.byteOffset,
        appKey.byteOffset + appKey.byteLength,
      ) as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh ?? arrayBufferToB64u(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToB64u(sub.getKey("auth"));

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;

  return "subscribed";
}

export async function disablePush(userId: string): Promise<void> {
  if (isNativePlatform()) {
    const { disableNativePush } = await import("@/lib/nativePush");
    return disableNativePush(userId);
  }
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", sub.endpoint);
    try {
      await sub.unsubscribe();
    } catch (_) {
      /* ignore */
    }
  }
}
