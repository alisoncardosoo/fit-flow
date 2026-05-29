import { supabase } from "@/integrations/supabase/client";
import { getPlatform } from "@/lib/native";
import type { PushStatus } from "@/lib/webPush";

/**
 * Push NATIVO (APNs no iOS) via @capacitor/push-notifications.
 *
 * Espelha a API de webPush.ts (enable/disable/getStatus) para que o PushToggle
 * funcione sem saber se está na web ou no app. O token APNs é guardado na mesma
 * tabela `push_subscriptions`, marcado com `platform = 'ios'` para que a edge
 * function `send-push` consiga separar destinos web (Web Push/VAPID) de nativos
 * (APNs). Veja CAPACITOR.md para o lado servidor do APNs.
 *
 * Eventos recebidos são encaminhados para o PushBridge via CustomEvents na
 * window, reaproveitando exatamente o mesmo toast premium já existente.
 */

let initialized = false;
let lastToken: string | null = null;

type RegistrationResolve = (token: string | null) => void;
let pendingRegistration: RegistrationResolve | null = null;

async function getPush() {
  const mod = await import("@capacitor/push-notifications");
  return mod.PushNotifications;
}

/** Liga os listeners uma única vez (registro de token + recebimento + toque). */
export async function initNativePush(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const PushNotifications = await getPush();

  // Token APNs emitido com sucesso.
  await PushNotifications.addListener("registration", (token) => {
    lastToken = token.value;
    if (pendingRegistration) {
      pendingRegistration(token.value);
      pendingRegistration = null;
    }
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("[nativePush] erro no registro APNs", err);
    if (pendingRegistration) {
      pendingRegistration(null);
      pendingRegistration = null;
    }
  });

  // Push recebido com o app em primeiro plano → mostra o toast in-app.
  await PushNotifications.addListener("pushNotificationReceived", (notif) => {
    const detail = normalize(notif.title, notif.body, notif.data);
    window.dispatchEvent(new CustomEvent("flow:push-received", { detail }));
  });

  // Usuário tocou na notificação → navega para a rota certa.
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const n = action.notification;
    const detail = normalize(n.title, n.body, n.data);
    window.dispatchEvent(new CustomEvent("flow:push-open", { detail }));
  });
}

/** Normaliza o payload APNs para o formato que o PushBridge espera. */
function normalize(
  title: string | undefined,
  body: string | undefined,
  data: Record<string, unknown> | undefined,
) {
  const d = data ?? {};
  return {
    title: title ?? (d.title as string | undefined),
    body: body ?? (d.body as string | undefined) ?? "",
    type: d.type as string | undefined,
    payload: (d.payload as Record<string, unknown>) ?? {},
    notification_id: (d.notification_id as string) ?? null,
    handle: (d.handle as string) ?? null,
  };
}

/** Solicita permissão, registra no APNs e devolve o device token. */
async function requestTokenOnce(): Promise<string | null> {
  const PushNotifications = await getPush();
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return null;

  const tokenPromise = new Promise<string | null>((resolve) => {
    pendingRegistration = resolve;
    // Timeout de segurança caso o APNs não responda.
    setTimeout(() => {
      if (pendingRegistration === resolve) {
        pendingRegistration = null;
        resolve(lastToken);
      }
    }, 8000);
  });

  await PushNotifications.register();
  return tokenPromise;
}

export async function enableNativePush(userId: string): Promise<PushStatus> {
  await initNativePush();
  const token = await requestTokenOnce();
  if (!token) return "denied";

  // `platform` é adicionado pela migração 20260529120000; ainda não consta nos
  // tipos gerados do Supabase, por isso o cast localizado.
  const row = {
    user_id: userId,
    endpoint: `apns:${token}`,
    p256dh: "",
    auth: "",
    platform: getPlatform(), // "ios"
    user_agent: `capacitor-${getPlatform()}`,
  };
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(row as never, { onConflict: "endpoint" });
  if (error) throw error;
  return "subscribed";
}

export async function disableNativePush(userId: string): Promise<void> {
  if (!lastToken) return;
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", `apns:${lastToken}`);
}

export async function getNativePushStatus(userId: string): Promise<PushStatus> {
  const PushNotifications = await getPush();
  const perm = await PushNotifications.checkPermissions();
  if (perm.receive === "denied") return "denied";
  if (perm.receive !== "granted") return "idle";
  if (!lastToken) return "idle";

  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", `apns:${lastToken}`)
    .maybeSingle();
  return data ? "subscribed" : "idle";
}
