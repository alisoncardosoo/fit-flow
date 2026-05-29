import { Capacitor } from "@capacitor/core";

/** True quando rodando dentro do container nativo (iOS/Android), false na web. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** "ios" | "android" | "web" */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Inicializa os plugins nativos do Capacitor. Seguro chamar sempre: vira no-op
 * na web. Faz:
 *  - StatusBar: estilo claro sobre o fundo escuro do tema, overlay do WebView.
 *  - SplashScreen: esconde assim que o app estiver pronto.
 *  - Keyboard: evita "saltos" de layout ao focar inputs.
 *  - App: trata deep links (OAuth do Supabase volta via custom scheme).
 *  - Push nativo (APNs): registra e encaminha eventos para o PushBridge.
 */
export async function initNative(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark }); // texto claro
    // No iOS o overlay deixa o conteúdo desenhar sob a barra (viewport-fit=cover)
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  } catch (e) {
    console.warn("[native] StatusBar indisponível", e);
  }

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
  } catch (e) {
    console.warn("[native] Keyboard indisponível", e);
  }

  // Deep links — fluxo OAuth do Supabase redireciona para o app via custom scheme.
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appUrlOpen", ({ url }) => {
      handleDeepLink(url);
    });
  } catch (e) {
    console.warn("[native] App listener indisponível", e);
  }

  // Push nativo (APNs). Importado dinamicamente para não pesar o bundle web.
  try {
    const { initNativePush } = await import("@/lib/nativePush");
    await initNativePush();
  } catch (e) {
    console.warn("[native] push nativo indisponível", e);
  }

  // Esconde a splash depois que tudo subiu.
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* noop */
  }
}

/**
 * Converte um deep link (ex.: com.fitflow.app://login-callback#access_token=...)
 * em uma rota interna que o React Router entende. Em custom schemes o "host" é
 * o destino (login-callback / reset-password); o Supabase devolve os tokens no
 * fragmento (#) ou query (?), que preservamos para o client detectar a sessão.
 */
function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);
    const host = parsed.host || parsed.pathname.replace(/^\/+/, "");
    const search = parsed.search || "";
    const hash = parsed.hash || "";

    // Mapeia o host do deep link para uma rota real do app.
    const route = host === "reset-password" ? "/reset-password" : "/";

    // Repassa para o app sem reload (o supabase-js detecta a sessão na URL).
    const target = `${route}${search}${hash}`;
    window.history.replaceState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch (e) {
    console.warn("[native] deep link inválido", url, e);
  }
}
