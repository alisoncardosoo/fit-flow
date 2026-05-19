# FitFlow Migration Checklist (Lovable -> Infra Propria)

Legenda:
- `[x]` concluido por mim nesta sessao
- `[ ]` pendente
- `[ ] (bloqueado)` depende de acesso externo/credenciais

## 0) Pre-flight

- [ ] Branch principal atualizada e sem conflitos (bloqueado: sem rede para validar remoto)
- [x] Build local ok (`npm run build`)
- [x] Testes locais ok (`npm test`)
- [x] `.env` fora do Git e `.env.example` atualizado
- [x] `send-push` com JWT habilitado (`verify_jwt = true`)

## 1) Staging - Supabase

- [ ] Instalar Supabase CLI (bloqueado: CLI ausente nesta maquina)
- [ ] `supabase login` (bloqueado)
- [ ] `supabase link --project-ref <STAGING_PROJECT_REF>` (bloqueado)
- [ ] `supabase db push` (bloqueado)
- [ ] Configurar secrets (bloqueado):
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `VAPID_PUBLIC_KEY`
  - [ ] `VAPID_PRIVATE_KEY`
  - [ ] `VAPID_SUBJECT`
- [ ] Deploy das functions (bloqueado):
  - [ ] `motivation`
  - [ ] `generate-workout`
  - [ ] `import-workout-from-image`
  - [ ] `reprocess-workout`
  - [ ] `suggest-exercises`
  - [ ] `ai-insights`
  - [ ] `generate-exercise-image`
  - [ ] `send-push`

## 2) Staging - Auth e Frontend

- [ ] Supabase Auth `Site URL` = `https://staging.seu-dominio.com` (bloqueado)
- [ ] Supabase Auth `Redirect URLs` (bloqueado):
  - [ ] `https://staging.seu-dominio.com`
  - [ ] `https://staging.seu-dominio.com/reset-password`
- [ ] Env do frontend em staging (bloqueado):
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
  - [ ] `VITE_APP_URL`
  - [ ] `VITE_AUTH_REDIRECT_URL`

## 3) Homologacao em Staging

- [ ] Cadastro com email/senha
- [ ] Login/logout
- [ ] Recuperacao de senha por email
- [ ] OAuth Google
- [ ] OAuth Apple
- [ ] Criar treino manual
- [ ] Importar treino por imagem
- [ ] Gerar treino com IA
- [ ] Upload de imagem de exercicio
- [ ] Push notification recebida

## 4) Producao - Supabase

- [ ] `supabase link --project-ref <PROD_PROJECT_REF>` (bloqueado)
- [ ] `supabase db push` (bloqueado)
- [ ] Configurar secrets de producao (bloqueado):
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `VAPID_PUBLIC_KEY`
  - [ ] `VAPID_PRIVATE_KEY`
  - [ ] `VAPID_SUBJECT`
- [ ] Deploy das functions de producao (mesma lista do staging) (bloqueado)

## 5) Producao - Auth e Frontend

- [ ] Supabase Auth `Site URL` = `https://seu-dominio.com` (bloqueado)
- [ ] Supabase Auth `Redirect URLs` (bloqueado):
  - [ ] `https://seu-dominio.com`
  - [ ] `https://seu-dominio.com/reset-password`
- [ ] Env do frontend em producao (bloqueado):
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
  - [ ] `VITE_APP_URL`
  - [ ] `VITE_AUTH_REDIRECT_URL`

## 6) Go-live Final

- [ ] Smoke test completo em producao (auth, treino, IA, upload, push) (bloqueado)
- [ ] Monitorar erros por 24h (auth/functions/storage)
- [x] Confirmar que nao ha dependencias do Lovable restantes
- [ ] Tag de release criada
