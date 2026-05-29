import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform } from "@/lib/native";

/**
 * Helpers de autenticação cientes da plataforma.
 *
 * Na web, os redirects do Supabase (confirmação de email, reset de senha e
 * OAuth) usam a origem do site. No app nativo (Capacitor) a origem é
 * `capacitor://localhost`, que não serve como redirect — então usamos um
 * deep link com custom scheme (`com.fitflow.app://...`) que o iOS devolve ao
 * app e o listener em `src/lib/native.ts` converte numa rota interna.
 */

// Mantenha em sincronia com o appId em capacitor.config.ts e o URL Scheme
// cadastrado no Xcode + Redirect URLs do Supabase.
export const NATIVE_SCHEME = "com.fitflow.app";

const WEB_APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

/** URL base de redirect para o ambiente atual. */
export function authRedirectBase(): string {
  return isNativePlatform() ? `${NATIVE_SCHEME}://login-callback` : WEB_APP_URL;
}

/** Redirect para o fluxo de reset de senha. */
export function resetPasswordRedirect(): string {
  if (isNativePlatform()) return `${NATIVE_SCHEME}://reset-password`;
  return (
    import.meta.env.VITE_AUTH_REDIRECT_URL || `${WEB_APP_URL}/reset-password`
  );
}

type Provider = "google" | "apple" | "github" | "facebook";

/**
 * Login social ciente da plataforma. Na web usa o fluxo padrão de redirect.
 * No app abre o provedor no navegador do sistema (@capacitor/browser) e
 * aguarda o retorno via deep link — o AuthProvider/native listener finaliza a
 * sessão a partir do fragmento devolvido.
 *
 * Pré-requisitos no nativo: URL Scheme no Xcode + Redirect URL no Supabase
 * (ver CAPACITOR.md, seção "Deep link do OAuth").
 */
export async function signInWithProvider(provider: Provider): Promise<void> {
  const redirectTo = authRedirectBase();

  if (!isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  // Nativo: não deixa o Supabase redirecionar a própria WebView; pegamos a URL
  // e abrimos no navegador do sistema, voltando pro app pelo custom scheme.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Não foi possível iniciar o login social");

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url });
}

// ---------- Sign in with Apple (nativo) ----------

/** Nonce aleatório (URL-safe) para o fluxo Sign in with Apple. */
function generateNonce(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 do nonce em hex (o que enviamos à Apple; o cru vai pro Supabase). */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Sign in with Apple.
 *
 * - No app iOS: usa o botão NATIVO (Face ID/Touch ID) via
 *   @capacitor-community/apple-sign-in e troca o identityToken por sessão no
 *   Supabase com `signInWithIdToken`. Esse é o caminho recomendado pela Apple
 *   (e exigido pela App Store se houver outros logins sociais).
 * - Na web (e Android): cai no fluxo OAuth padrão via `signInWithProvider`.
 *
 * Pré-requisitos: provider Apple habilitado no Supabase e capability
 * "Sign in with Apple" no target do Xcode (ver CAPACITOR.md).
 */
export async function signInWithApple(): Promise<void> {
  if (!isNativePlatform()) {
    await signInWithProvider("apple");
    return;
  }

  const { SignInWithApple } = await import(
    "@capacitor-community/apple-sign-in"
  );

  const rawNonce = generateNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  const result = await SignInWithApple.authorize({
    // No fluxo nativo o clientId é o bundle id do app.
    clientId: NATIVE_SCHEME,
    redirectURI: `${NATIVE_SCHEME}://login-callback`,
    scopes: "name email",
    nonce: hashedNonce,
  });

  const idToken = result.response?.identityToken;
  if (!idToken) throw new Error("A Apple não retornou o token de identidade");

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}
