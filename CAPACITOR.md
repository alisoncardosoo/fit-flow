# 📱 FitFlow iOS (Capacitor)

Este projeto já está empacotado com [Capacitor](https://capacitorjs.com/) para
rodar como **app iOS nativo** reaproveitando ~95% do código web. O backend
(Supabase) **não muda**.

> **Importante:** o build, a assinatura e a publicação na App Store **exigem um
> Mac com Xcode** e uma **conta Apple Developer** (US$ 99/ano). O que está neste
> repositório é todo o lado de código — pronto pra abrir no Xcode.

---

## 🗂️ O que já está configurado

- `capacitor.config.ts` — app id `com.fitflow.app`, `webDir: dist`, splash, status bar e push.
- `ios/` — projeto Xcode nativo gerado (Capacitor 8, **sem CocoaPods** — usa Swift Package Manager).
- Plugins instalados: `app`, `browser`, `haptics`, `keyboard`, `push-notifications`, `splash-screen`, `status-bar`.
- `src/lib/native.ts` — inicializa status bar, splash, teclado e deep links (no-op na web).
- `src/lib/nativePush.ts` — push nativo via APNs; espelha a API do `webPush.ts`.
- `src/components/PushBridge.tsx` — agora também escuta os eventos de push nativo (reaproveita o toast premium).
- `AppDelegate.swift` — encaminha o token APNs ao plugin.
- `Info.plist` — `UIBackgroundModes: remote-notification`.
- Migração `..._push_subscriptions_platform.sql` — coluna `platform` para separar destinos web/APNs.

A UI de push (`PushToggle`) **não precisou mudar**: `webPush.ts` detecta o
ambiente nativo e delega automaticamente para o APNs.

---

## 🚀 Workflow de desenvolvimento

```bash
# Build do web + copia para o projeto iOS
npm run ios:build

# Abre o projeto no Xcode (precisa de Mac)
npm run ios:open

# Atalho: build + sync + open
npm run ios:run
```

| Script           | O que faz                                  |
|------------------|--------------------------------------------|
| `npm run ios:sync`  | `cap sync ios` (copia assets + plugins) |
| `npm run ios:build` | `vite build` + `cap sync ios`           |
| `npm run ios:open`  | abre no Xcode                           |
| `npm run ios:run`   | build + sync + open                     |

### Live reload no iPhone (opcional)
Descomente o bloco `server` em `capacitor.config.ts`, coloque o IP da sua
máquina, rode `npm run dev` e `npm run ios:run`. As mudanças aparecem sem rebuild.

---

## ✅ Passos restantes (exigem Mac + conta Apple)

### 1. Abrir e assinar
1. `npm run ios:open` → abre o Xcode.
2. Selecione o target **App** → aba **Signing & Capabilities**.
3. Escolha seu **Team** (conta Apple Developer). Bundle id: `com.fitflow.app`.

### 2. Habilitar Push Notifications
1. Em **Signing & Capabilities**, clique **+ Capability** → **Push Notifications**.
2. Adicione também **Background Modes** → marque **Remote notifications**
   (o `Info.plist` já declara isso, mas a capability precisa estar ligada).

### 3. Deep link do OAuth / emails de auth
Os redirects do Supabase precisam voltar para o app via custom scheme. O código
já trata isso (`src/lib/auth.ts` escolhe o redirect certo por plataforma e
`src/lib/native.ts` converte o deep link em rota interna). Falta só configurar:
1. No Xcode: target **App** → **Info** → **URL Types** → **+**.
2. **URL Schemes** = `com.fitflow.app`.
3. No painel do Supabase (**Authentication → URL Configuration → Redirect URLs**),
   adicione:
   - `com.fitflow.app://login-callback` (signup/confirmação de email e OAuth)
   - `com.fitflow.app://reset-password` (redefinição de senha)

**Login social (Google e outros):** use o helper pronto:
```ts
import { signInWithProvider } from "@/lib/auth";
// <button onClick={() => signInWithProvider("google")}>Entrar com Google</button>
```
Ele usa o fluxo de redirect na web e, no app, abre o provedor no navegador do
sistema (`@capacitor/browser`) e volta pelo deep link. Habilite o provider em
**Authentication → Providers** no Supabase (com as credenciais OAuth do provedor).

### Sign in with Apple (nativo) — já implementado

A tela `Auth.tsx` já tem o botão **Entrar com Apple**. No app iOS ele usa o
botão nativo (Face ID/Touch ID) via `@capacitor-community/apple-sign-in` e troca
o `identityToken` por sessão no Supabase (`signInWithIdToken`, com nonce). Na web
cai no fluxo OAuth. Falta só a configuração (feita por você):

1. **Apple Developer:**
   - No **App ID** `com.fitflow.app`, habilite a capability **Sign in with Apple**.
   - Crie um **Services ID** (será o `client_id` do provider).
   - Em **Keys**, crie uma **Sign in with Apple key (.p8)** → anote **Key ID** e **Team ID**.
     > ⚠️ Esta `.p8` é **diferente** da `.p8` do APNs (push). São duas chaves distintas.
2. **Xcode:** target **App** → **Signing & Capabilities** → **+ Capability** →
   **Sign in with Apple**.
3. **Supabase** (**Authentication → Providers → Apple**): habilite e informe o
   Services ID + o segredo gerado a partir da `.p8`/Key ID/Team ID. Adicione o
   bundle id `com.fitflow.app` nos client IDs autorizados (necessário para o
   `signInWithIdToken` nativo).

> 📌 **App Store (guideline 4.8):** se o app oferecer outros logins sociais
> (ex.: Google), o Sign in with Apple passa a ser **obrigatório**.

### 4. Ícones e splash
Use [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):
```bash
npx @capacitor/assets generate --ios   # gera a partir de um icon/splash fonte
```

### 5. Rodar no device / simulador
No Xcode, selecione um simulador ou iPhone conectado e aperte **Run (⌘R)**.

---

## 🔔 Push nativo (APNs) — lado servidor

A edge function `send-push` **já envia para os dois canais**: Web Push (VAPID)
para browser/PWA e **APNs** para tokens nativos iOS. Ela busca todas as
inscrições do usuário e separa por `platform`: linhas `ios` (token salvo como
`apns:<token>`) vão por APNs HTTP/2 com auth por token (.p8); as demais seguem
por Web Push como antes.

Se os secrets do APNs **não** estiverem configurados, o envio APNs é pulado
silenciosamente (o Web Push continua funcionando normalmente).

### Configurar o APNs

1. No [Apple Developer](https://developer.apple.com) → **Keys**, crie uma
   **APNs Auth Key (.p8)**. Guarde: `Key ID`, `Team ID` e o arquivo `.p8`.
2. Configure os secrets no Supabase:
   ```bash
   supabase secrets set \
     APNS_KEY_ID=ABC123XYZ \
     APNS_TEAM_ID=TEAMID1234 \
     APNS_BUNDLE_ID=com.fitflow.app \
     APNS_HOST=api.sandbox.push.apple.com \
     APNS_PRIVATE_KEY="$(cat AuthKey_ABC123XYZ.p8)"
   ```
   - `APNS_HOST` = `api.sandbox.push.apple.com` para builds de **dev** (rodando
     via Xcode) e `api.push.apple.com` para **produção** (TestFlight/App Store).
3. Faça deploy: `supabase functions deploy send-push`.

> O cliente (`src/lib/nativePush.ts`) já registra o device token e o salva em
> `push_subscriptions` com `platform = 'ios'`. Nada mais a fazer no app.

> Tokens mortos (HTTP 410 / `BadDeviceToken`) são removidos automaticamente,
> igual ao fluxo Web Push.

---

## 🍎 Publicar na App Store

1. Xcode → **Product → Archive**.
2. **Distribute App → App Store Connect**.
3. Em [App Store Connect](https://appstoreconnect.apple.com), preencha ficha,
   screenshots, política de privacidade e envie para review.

---

## 🧯 Troubleshooting

- **Tela branca no device:** rode `npm run ios:build` antes de abrir o Xcode
  (o `webDir: dist` precisa existir e estar atualizado).
- **Push não chega:** confirme a capability *Push Notifications*, o
  *Background Modes → Remote notifications*, e o ambiente APNs (sandbox vs prod).
- **OAuth não volta pro app:** confira o URL Scheme e o Redirect URL no Supabase.
- **Plugin não encontrado após instalar um novo:** rode `npm run ios:sync`.
