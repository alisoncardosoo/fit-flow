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

### 3. Deep link do OAuth (login social)
O login social do Supabase precisa voltar para o app via custom scheme:
1. No Xcode: target **App** → **Info** → **URL Types** → **+**.
2. **URL Schemes** = `com.fitflow.app`.
3. No painel do Supabase (**Authentication → URL Configuration**), adicione
   `com.fitflow.app://login-callback` em **Redirect URLs**.
4. Ao chamar `signInWithOAuth`, use `redirectTo: 'com.fitflow.app://login-callback'`
   quando estiver no app nativo (`isNativePlatform()`).

### 4. Ícones e splash
Use [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):
```bash
npx @capacitor/assets generate --ios   # gera a partir de um icon/splash fonte
```

### 5. Rodar no device / simulador
No Xcode, selecione um simulador ou iPhone conectado e aperte **Run (⌘R)**.

---

## 🔔 Push nativo (APNs) — lado servidor (TODO)

O cliente já registra o token APNs e o salva em `push_subscriptions` com
`platform = 'ios'`. A edge function `send-push` atual envia **apenas Web Push
(VAPID)** — ela agora filtra `platform = 'web'`, então os tokens iOS são
ignorados por ela (sem quebrar nada).

Para entregar push no iOS, falta criar o envio via **APNs HTTP/2**:

1. No [Apple Developer](https://developer.apple.com) → **Keys**, crie uma
   **APNs Auth Key (.p8)**. Guarde: `Key ID`, `Team ID`, e o conteúdo do `.p8`.
2. Configure os secrets no Supabase:
   ```bash
   supabase secrets set APNS_KEY_ID=xxx APNS_TEAM_ID=yyy \
     APNS_BUNDLE_ID=com.fitflow.app APNS_PRIVATE_KEY="$(cat AuthKey_xxx.p8)"
   ```
3. Crie uma function `send-push-apns` (ou ramo na `send-push`) que:
   - lê as inscrições com `platform = 'ios'`;
   - monta um JWT ES256 assinado com a `.p8` (`alg: ES256`, header `kid`/`iss`/`iat`);
   - faz `POST https://api.push.apple.com/3/device/<token>` com headers
     `authorization: bearer <jwt>`, `apns-topic: com.fitflow.app`, `apns-push-type: alert`;
   - corpo: `{ "aps": { "alert": { "title", "body" }, "sound": "default" },
     "type", "payload", "notification_id", "handle" }`.
   - O `crypto.subtle` (ES256) já é usado na `send-push` atual — dá pra reaproveitar os helpers de assinatura.
4. Atualize o trigger/DB que chama `send-push` para também chamar `send-push-apns`.

> Em produção use `api.push.apple.com`; no ambiente de desenvolvimento (builds
> via Xcode) use `api.sandbox.push.apple.com`.

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
