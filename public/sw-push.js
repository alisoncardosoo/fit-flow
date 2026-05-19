/* Premium Web Push service worker for FitFlow.
   - Rich title/body with @username highlighted
   - Per-type emoji + accent
   - Action buttons (Ver / Marcar como lida)
   - Vibration pattern
   - Forwards to open clients so the app can show an in-app premium toast. */

const APP_NAME = "FitFlow";
const ICON = "/icon-192.png";
const BADGE = "/icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const TYPE_META = {
  friend_request:    { emoji: "👥", label: "Pedido de amizade",   color: "purple" },
  friend_accepted:   { emoji: "🤝", label: "Nova amizade",         color: "emerald" },
  friend_workout:    { emoji: "💪", label: "Treino do amigo",      color: "primary" },
  reaction_received: { emoji: "❤️", label: "Reação recebida",      color: "pink" },
  challenge_invite:  { emoji: "🏆", label: "Desafio",              color: "orange" },
  challenge_overtaken:{emoji: "⚡", label: "Desafio",              color: "red" },
  challenge_won:     { emoji: "👑", label: "Desafio vencido",      color: "yellow" },
};

function metaFor(type) {
  return TYPE_META[type] || { emoji: "✨", label: APP_NAME, color: "primary" };
}

/** Try to extract @handle from the body (which is "@user fez X..."). */
function extractHandle(body) {
  if (!body) return null;
  const m = String(body).match(/@[a-z0-9_.]{3,30}/i);
  return m ? m[0] : null;
}

self.addEventListener("push", (event) => {
  let data = { title: APP_NAME, body: "", type: "", payload: {}, notification_id: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  const meta = metaFor(data.type);
  const handle = extractHandle(data.body) || extractHandle(data.title);

  // Premium title: emoji + @handle when available, fallback to original title
  const title = handle
    ? `${meta.emoji}  ${handle}`
    : `${meta.emoji}  ${data.title || APP_NAME}`;

  // Body: original message (already includes @ + verb), plus a quiet category line
  const body = handle
    ? `${(data.body || data.title || "").replace(handle, "").replace(/^\s+/, "").trim() || data.title}\n${meta.label}`
    : `${data.body || ""}\n${meta.label}`;

  const url = pickUrl(data);

  const options = {
    body,
    icon: ICON,
    badge: BADGE,
    tag: data.notification_id || data.type || "fitflow-notif",
    renotify: true,
    requireInteraction: false,
    vibrate: [60, 30, 60],
    timestamp: Date.now(),
    data: {
      url,
      notification_id: data.notification_id,
      type: data.type,
      payload: data.payload || {},
      title: data.title,
      body: data.body,
      handle,
    },
    actions: [
      { action: "open", title: "Ver" },
      { action: "dismiss", title: "Marcar lida" },
    ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Forward to any open app windows so they can show a premium in-app toast
      // and update the bell badge instantly (without waiting for realtime).
      broadcast({
        kind: "push-received",
        title: data.title,
        body: data.body,
        type: data.type,
        payload: data.payload || {},
        notification_id: data.notification_id,
        handle,
      }),
    ]),
  );
});

async function broadcast(message) {
  try {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of list) client.postMessage(message);
  } catch (_) { /* ignore */ }
}

function pickUrl(data) {
  const p = data && data.payload ? data.payload : {};
  switch (data.type) {
    case "friend_request":
    case "friend_accepted":
      return "/social";
    case "friend_workout":
    case "reaction_received":
      return "/history";
    case "challenge_invite":
    case "challenge_overtaken":
    case "challenge_won":
      return p.challenge_id ? `/challenges/${p.challenge_id}` : "/challenges";
    default:
      return "/";
  }
}

// ---------- Local rest-timer scheduling ----------
let _restTimerTimeout = null;

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "schedule-rest-timer") {
    if (_restTimerTimeout) { clearTimeout(_restTimerTimeout); _restTimerTimeout = null; }
    const delay = Math.max(0, data.endsAt - Date.now());
    _restTimerTimeout = setTimeout(async () => {
      _restTimerTimeout = null;
      try {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        if (clients.some((c) => c.focused)) return; // app in foreground — skip OS notif
        await self.registration.showNotification("⏱ Descanso concluído!", {
          body: "Hora de voltar ao treino 💪",
          icon: ICON,
          badge: BADGE,
          tag: "rest-timer",
          requireInteraction: true,
          vibrate: [100, 50, 100],
          data: { type: "rest-timer" },
          actions: [{ action: "open", title: "Abrir treino" }],
        });
      } catch (_) { /* ignore */ }
    }, delay);
  }

  if (data.type === "cancel-rest-timer") {
    if (_restTimerTimeout) { clearTimeout(_restTimerTimeout); _restTimerTimeout = null; }
    self.registration.getNotifications({ tag: "rest-timer" })
      .then((ns) => ns.forEach((n) => n.close()))
      .catch(() => {});
  }
});

self.addEventListener("notificationclick", (event) => {
  const notifType = event.notification.data && event.notification.data.type;
  if (notifType === "rest-timer") {
    event.notification.close();
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const client of list) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow("/");
      }),
    );
    return;
  }

  const action = event.action;
  const target = (event.notification.data && event.notification.data.url) || "/";

  if (action === "dismiss") {
    event.notification.close();
    return;
  }

  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
