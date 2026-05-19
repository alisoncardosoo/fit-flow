# FitFlow

FitFlow é um app fitness premium, mobile-first e orientado a consistência. A proposta do produto é transformar treino em um fluxo simples, inteligente e social: organizar fichas, executar sessões com menos fricção, acompanhar evolução real e usar IA para acelerar planejamento, análise e motivação.

O projeto combina uma interface em React + Vite com backend em Supabase, recursos de IA via Edge Functions e uma experiência pensada para parecer app nativo, inclusive com PWA, notificações push, navegação em dock e foco em uso recorrente no celular.

## Visão do Produto

### Objetivo principal

Ajuda pessoas a:

- criar, importar e editar treinos com rapidez;
- executar séries com fluidez durante a sessão;
- visualizar progresso com dados claros;
- manter consistência por meio de metas, streaks e conquistas;
- adicionar contexto social ao treino com amigos, ranking, reações e desafios;
- usar IA para gerar treinos, analisar evolução e sugerir próximos passos.

### Posicionamento da marca

No código, a marca principal aparece como `FitFlow`, com mensagens como:

- `FitFlow.`
- `Seu fluxo. Sua evolução.`
- `Treinos inteligentes que viciam`

Visualmente, a identidade do app é:

- dark mode por padrão;
- acento neon lime como cor assinatura;
- look premium com superfícies glass, gradientes e brilho;
- tipografia de display forte para sensação de produto aspiracional.

### Observação importante sobre naming

Atualmente, a interface, metadados SEO e PWA estão alinhados com a marca `FitFlow`.

## O Que o App Entrega

### 1. Autenticação e entrada no produto

O app já possui:

- cadastro com email e senha;
- login com email e senha;
- login social via Supabase OAuth;
- fluxo de recuperação e redefinição de senha;
- onboarding em 3 etapas;
- configuração inicial de username público.

Durante o onboarding, o usuário informa:

- objetivo fitness;
- nível de treino;
- meta semanal.

Depois disso, o perfil passa a alimentar recomendações, analytics e componentes de gamificação.

### 2. Dashboard inteligente

A tela inicial entrega uma visão resumida da jornada do usuário:

- saudação contextual;
- streak atual;
- próximo treino;
- volume semanal;
- contagem de treinos na semana;
- último treino realizado;
- meta mensal;
- amigos treinando ao vivo;
- ranking social;
- mensagem motivacional gerada por IA.

É o centro da experiência diária do produto.

### 3. Biblioteca de treinos

O módulo de treinos permite:

- listar treinos ativos, arquivados e mais usados;
- criar treino manualmente;
- duplicar treino;
- arquivar e restaurar;
- excluir treino;
- reprocessar treino quando necessário;
- iniciar execução rapidamente;
- sincronizar a lista em tempo real com React Query + Supabase.

Cada treino pode conter:

- uma ou mais fichas;
- lista ordenável de exercícios;
- séries, repetições, descanso e carga alvo;
- cor e descrição.

### 4. Editor de treino

O projeto possui estrutura para edição detalhada do treino:

- renomear treino;
- ajustar cor;
- adicionar exercícios;
- editar séries, repetições, carga e descanso;
- reordenar exercícios;
- trabalhar com fichas (`routine_sheets`);
- persistir defaults do usuário para novos exercícios.

### 5. Execução do treino

A execução é um dos pontos mais fortes do produto. O fluxo inclui:

- seleção automática ou manual de ficha;
- histórico da última ficha usada para sugerir próxima rotação;
- navegação por swipe entre exercícios;
- marcação de séries concluídas;
- sugestão de carga com base no último log;
- timer de descanso;
- pré-carregamento de imagens dos próximos exercícios;
- criação de sessão ativa e atualização em tempo real;
- encerramento da sessão com persistência de volume e duração;
- checagem automática de medalhas conquistadas.

Em termos de UX, a proposta é reduzir o atrito entre "abrir o app" e "terminar o treino".

### 6. Biblioteca de exercícios

O app mantém uma biblioteca pesquisável e filtrável de exercícios com:

- busca textual;
- filtro por grupo muscular;
- filtro por equipamento;
- nível de dificuldade;
- descrição e dicas;
- imagem do exercício;
- cadastro de exercício customizado;
- sugestões com IA por grupo muscular.

Há também geração de imagem por IA para exercícios do usuário, com upload para Storage.

### 7. Importação de treino por imagem

Um diferencial do produto já implementado:

- importar foto de planilha, ficha da academia ou print de outro app;
- compressão da imagem no cliente;
- análise por IA multimodal;
- identificação de múltiplas fichas (`A`, `B`, `C`, etc.);
- criação automática dos treinos;
- criação de exercícios ausentes na biblioteca quando necessário;
- abertura rápida do treino importado para ajuste fino.

Esse fluxo reduz drasticamente o trabalho manual de migração para o app.

### 8. Analytics e inteligência de evolução

O módulo `Analytics` oferece uma leitura rica do desempenho:

- score de performance;
- streak;
- frequência semanal em relação à meta;
- evolução de carga;
- comparação de períodos;
- recordes pessoais;
- distribuição por grupos musculares;
- duração das sessões;
- mapas e gráficos com Recharts;
- alertas automáticos;
- insights textuais calculados localmente.

Além disso, existe um card de análise com IA que gera:

- resumo do momento do usuário;
- insights positivos e alertas;
- recomendações práticas;
- previsão para os próximos 30 dias;
- ações aplicáveis com um toque, como:
  - ajustar meta semanal;
  - gerar um treino novo com IA.

### 9. Metas e progresso

O sistema de metas cobre dois grandes cenários:

- metas de performance/frequência;
- metas corporais e customizadas.

O usuário pode:

- criar novas metas;
- acompanhar progresso;
- registrar avanço manual;
- ver histórico de medições corporais;
- editar e excluir metas;
- acompanhar metas conquistadas;
- receber celebração visual ao bater um objetivo.

O app também mantém metas mensais, usadas tanto no dashboard quanto em conquistas.

### 10. Conquistas e gamificação

Existe um catálogo de medalhas já modelado no projeto, com categorias como:

- marcos de treino;
- consistência;
- metas mensais;
- recordes de força;
- volume acumulado.

Exemplos implementados:

- primeiro treino;
- 10, 50, 100 e 250 treinos;
- streak de 3, 7 e 30 dias;
- metas mensais concluídas;
- PRs de supino, agachamento, terra e desenvolvimento;
- 10t e 50t de volume acumulado.

O usuário consegue:

- ver o que já desbloqueou;
- entender o progresso de medalhas ainda bloqueadas;
- ajustar meta mensal diretamente nessa área.

### 11. Histórico

O histórico registra sessões finalizadas com:

- nome do treino;
- data;
- duração;
- volume total;
- autoria da sessão;
- reações sociais.

Como a política social já está integrada, o histórico pode mostrar também sessões de amigos autorizados pela RLS.

### 12. Social

O módulo social está bastante completo e inclui:

- código pessoal de convite;
- link de convite;
- compartilhamento nativo;
- atalho para WhatsApp;
- envio e recebimento de convites;
- aceite e recusa de amizade;
- remoção de amizade;
- ranking semanal entre amigos;
- visualização de amigos treinando ao vivo;
- reações em sessões;
- comparação entre você e um amigo em múltiplas janelas de tempo.

Esse conjunto posiciona o FitFlow como um fitness app com camada social real, não apenas um tracker individual.

### 13. Desafios

O sistema de desafios permite:

- criar desafios;
- convidar amigos;
- entrar ou sair de desafios;
- acompanhar leaderboard;
- ver desafios ativos e encerrados.

Tipos de desafio já suportados:

- `most_sessions` — quem fez mais treinos;
- `most_volume` — maior volume acumulado;
- `most_frequency` — maior frequência em dias.

Períodos suportados:

- semanal;
- mensal;
- customizado.

### 14. Compartilhamento de evolução

O app gera cards visuais para stories com:

- streak;
- treinos na semana;
- meta semanal;
- volume total;
- total de sessões;
- top PRs;
- período selecionado.

O card é exportado em:

- `1080x1920`

e pode ser:

- baixado;
- compartilhado via Web Share API quando suportado.

### 15. Notificações e push

O projeto já possui estrutura para notificações internas e Web Push.

Tipos de notificação identificados no código:

- pedido de amizade;
- amizade aceita;
- treino do amigo;
- reação recebida;
- convite para desafio;
- ultrapassagem em desafio;
- vitória em desafio.

O usuário pode:

- visualizar central de notificações;
- marcar como lidas;
- limpar tudo;
- ativar ou desativar push.

O envio Web Push é implementado no backend com VAPID e fan-out para múltiplas subscriptions por usuário.

## Fluxo Principal do Usuário

Em alto nível, a jornada ideal pensada pelo produto é:

1. criar conta ou entrar;
2. concluir onboarding;
3. definir `@username`;
4. montar ou importar treinos;
5. executar sessões com mínimo atrito;
6. acompanhar progresso e insights;
7. manter consistência por metas, streaks e medalhas;
8. adicionar amigos e competir em desafios;
9. compartilhar evolução fora do app.

## Stack do Projeto

### Frontend

- React 18
- TypeScript
- Vite
- React Router DOM
- TanStack React Query
- Tailwind CSS
- shadcn/ui + Radix UI
- Framer Motion
- Recharts
- Sonner

### Backend e dados

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions

### Recursos complementares

- Supabase OAuth para provedores sociais
- Web Push com Service Worker
- HTML-to-Image para exportação de cards

## Arquitetura em Alto Nível

### Frontend

O frontend está organizado principalmente em:

- `src/pages` — telas do produto;
- `src/components` — blocos reutilizáveis de UI e produto;
- `src/services` — acesso a dados e agregações por domínio;
- `src/lib` — regras auxiliares, integrações, cálculos e helpers;
- `src/hooks` — hooks de autenticação, metas, realtime e utilidades.

### Backend

O backend é fortemente orientado ao Supabase:

- autenticação e sessão no Supabase Auth;
- persistência em Postgres;
- regras de acesso via RLS;
- lógica assíncrona e IA nas Edge Functions;
- assets gerados no Storage;
- atualizações em tempo real com canais do Supabase.

### Entidades centrais do domínio

Pelo código, as principais entidades do sistema são:

- `profiles`
- `workouts`
- `routine_sheets`
- `workout_exercises`
- `workout_sessions`
- `set_logs`
- `exercises`
- `goals`
- `body_measurements`
- `monthly_goals`
- `achievements`
- `friend_codes`
- `friendships`
- `active_sessions`
- `reactions`
- `notifications`
- `challenges`
- `challenge_participants`
- `push_subscriptions`
- `ai_insights`
- `exercise_image_map`

Também existem RPCs importantes, como:

- `get_user_streak`
- `get_monthly_progress`
- `get_exercise_pr`
- `get_public_profiles`
- `get_friend_ranking`
- `get_friend_comparison`
- `is_username_available`

## Edge Functions

O projeto já possui as seguintes funções em `supabase/functions`:

### `motivation`

Gera uma mensagem curta de motivação com base em:

- streak;
- treinos da semana;
- meta semanal;
- nome do atleta.

### `generate-workout`

Cria treino com IA a partir de:

- foco;
- duração;
- equipamento disponível.

### `import-workout-from-image`

Extrai fichas de treino de uma imagem e cria:

- treinos;
- ficha padrão;
- exercícios novos, se necessário;
- vínculos com a biblioteca existente.

### `reprocess-workout`

Recupera treinos problemáticos:

- cria ficha padrão se faltar;
- religa exercícios órfãos;
- pode regenerar exercícios com IA se o treino estiver vazio.

### `suggest-exercises`

Sugere novos exercícios para um grupo muscular com apoio de IA.

### `ai-insights`

Analisa os últimos dados do usuário e retorna:

- resumo;
- insights;
- recomendações;
- forecast;
- cache temporário para reduzir custo.

### `generate-exercise-image`

Gera imagem de exercício por IA e salva no bucket de imagens.

### `send-push`

Lê notificações pendentes e envia Web Push para subscriptions do usuário.

## Estrutura de Navegação

As rotas principais da aplicação são:

- `/auth`
- `/forgot-password`
- `/reset-password`
- `/onboarding`
- `/username`
- `/`
- `/workouts`
- `/workouts/:id`
- `/execute/:id`
- `/library`
- `/analytics`
- `/history`
- `/profile`
- `/achievements`
- `/goals`
- `/share`
- `/social`
- `/social/add`
- `/social/invite/:code`
- `/social/compare/:friendId`
- `/challenges`
- `/challenges/new`
- `/challenges/:id`

## Design System e Experiência

O design system implementado em `src/index.css` revela a intenção do produto:

- base escura com undertone esverdeado;
- cor primária lime neon;
- superfícies premium com gradiente;
- efeitos glass;
- sombras fortes;
- componentes com raio alto;
- safe areas e espaçamento pensados para uso mobile;
- dock inferior flutuante;
- animações suaves com Framer Motion.

Isso não é apenas estética: a interface foi modelada para parecer um app nativo de treino, não um painel web genérico.

## PWA

O projeto já possui recursos de Progressive Web App:

- `manifest.webmanifest`;
- ícones `192x192` e `512x512`;
- `apple-touch-icon`;
- orientação vertical;
- `display: standalone`.

Também existe um service worker específico para push:

- `public/sw-push.js`

## Como Rodar Localmente

### Pré-requisitos

- Node.js 18+ recomendado
- npm
- projeto Supabase configurado

### Instalação

```bash
npm install
```

### Ambiente

Crie as variáveis necessárias para o frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_URL=
VITE_AUTH_REDIRECT_URL=
```

Além disso, as Edge Functions dependem de segredos no Supabase:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

`AI_PROVIDER_API_KEY` global é opcional. O app prioriza a chave individual de cada usuário (configurada em `Perfil > Configurações`).

### Checklist de Secrets por Ambiente

#### Dev (local)

- Frontend (`.env`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_APP_URL=http://localhost:8080`
  - `VITE_AUTH_REDIRECT_URL=http://localhost:8080/reset-password`
- Supabase Functions (secrets no projeto Supabase):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`

#### Staging

- Frontend:
  - `VITE_APP_URL=https://staging.seu-dominio.com`
  - `VITE_AUTH_REDIRECT_URL=https://staging.seu-dominio.com/reset-password`
- Supabase Functions:
  - Mesmo conjunto de secrets do `dev`, mas com chaves do projeto de staging.
- Auth Providers (Supabase Dashboard):
  - `Site URL` e `Redirect URLs` apontando para staging.

#### Produção

- Frontend:
  - `VITE_APP_URL=https://seu-dominio.com`
  - `VITE_AUTH_REDIRECT_URL=https://seu-dominio.com/reset-password`
- Supabase Functions:
  - Mesmo conjunto de secrets do `staging`, com chaves de produção.
- Auth Providers (Supabase Dashboard):
  - `Site URL` e `Redirect URLs` de produção.
- Segurança:
  - `functions.send-push.verify_jwt = true` em `supabase/config.toml`.

### Runbook de Migração (Supabase)

Use este passo a passo quando for publicar em `staging` e `produção`.

#### 1) Instalar CLI e autenticar

```bash
brew install supabase/tap/supabase
supabase login
```

#### 2) Staging

```bash
# dentro da raiz do projeto
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db push

supabase secrets set \
  SUPABASE_URL=https://<STAGING_PROJECT_REF>.supabase.co \
  SUPABASE_ANON_KEY=<STAGING_ANON_KEY> \
  SUPABASE_SERVICE_ROLE_KEY=<STAGING_SERVICE_ROLE_KEY> \
  VAPID_PUBLIC_KEY=<STAGING_VAPID_PUBLIC_KEY> \
  VAPID_PRIVATE_KEY=<STAGING_VAPID_PRIVATE_KEY> \
  VAPID_SUBJECT=mailto:<SEU_EMAIL>

supabase functions deploy motivation
supabase functions deploy generate-workout
supabase functions deploy import-workout-from-image
supabase functions deploy reprocess-workout
supabase functions deploy suggest-exercises
supabase functions deploy ai-insights
supabase functions deploy generate-exercise-image
supabase functions deploy send-push
```

No Supabase Dashboard (staging):
- `Authentication > URL Configuration > Site URL`: `https://staging.seu-dominio.com`
- `Redirect URLs`:
  - `https://staging.seu-dominio.com`
  - `https://staging.seu-dominio.com/reset-password`

No deploy frontend (staging):
- `VITE_SUPABASE_URL=https://<STAGING_PROJECT_REF>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<STAGING_PUBLISHABLE_KEY>`
- `VITE_APP_URL=https://staging.seu-dominio.com`
- `VITE_AUTH_REDIRECT_URL=https://staging.seu-dominio.com/reset-password`

#### 3) Produção

```bash
# dentro da raiz do projeto
supabase link --project-ref <PROD_PROJECT_REF>
supabase db push

supabase secrets set \
  SUPABASE_URL=https://<PROD_PROJECT_REF>.supabase.co \
  SUPABASE_ANON_KEY=<PROD_ANON_KEY> \
  SUPABASE_SERVICE_ROLE_KEY=<PROD_SERVICE_ROLE_KEY> \
  VAPID_PUBLIC_KEY=<PROD_VAPID_PUBLIC_KEY> \
  VAPID_PRIVATE_KEY=<PROD_VAPID_PRIVATE_KEY> \
  VAPID_SUBJECT=mailto:<SEU_EMAIL>

supabase functions deploy motivation
supabase functions deploy generate-workout
supabase functions deploy import-workout-from-image
supabase functions deploy reprocess-workout
supabase functions deploy suggest-exercises
supabase functions deploy ai-insights
supabase functions deploy generate-exercise-image
supabase functions deploy send-push
```

No Supabase Dashboard (produção):
- `Authentication > URL Configuration > Site URL`: `https://seu-dominio.com`
- `Redirect URLs`:
  - `https://seu-dominio.com`
  - `https://seu-dominio.com/reset-password`

No deploy frontend (produção):
- `VITE_SUPABASE_URL=https://<PROD_PROJECT_REF>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<PROD_PUBLISHABLE_KEY>`
- `VITE_APP_URL=https://seu-dominio.com`
- `VITE_AUTH_REDIRECT_URL=https://seu-dominio.com/reset-password`

#### 4) Verificação pós-deploy (go-live)

1. Criar conta por email/senha.
2. Login/logout.
3. Reset de senha via email.
4. Login social (Google/Apple).
5. Criar treino.
6. Importar treino por imagem.
7. Gerar treino com IA.
8. Upload de imagem de exercício.
9. Receber notificação push.
10. Rodar `npm run build` no branch final.

### Desenvolvimento

```bash
npm run dev
```

O Vite sobe por padrão em:

- `http://localhost:8080`

### Build de produção

```bash
npm run build
```

### Preview local

```bash
npm run preview
```

### Testes

```bash
npm test
```

## Supabase

O repositório contém:

- `supabase/config.toml`
- `supabase/migrations`
- `supabase/functions`

Isso indica que o projeto foi preparado para versionar:

- schema;
- regras de dados;
- funções server-side.

Para rodar o ambiente completo, o fluxo esperado é usar a CLI do Supabase para:

- conectar o projeto;
- aplicar migrations;
- publicar Edge Functions;
- configurar secrets.

## Qualidade e Estado Atual

### Pontos fortes já presentes

- produto com escopo real, não apenas boilerplate;
- UI consistente e bem direcionada;
- integração sólida entre frontend e backend;
- camada de IA aplicada a casos úteis;
- domínio fitness bem modelado;
- recursos sociais acima da média para um MVP.

### Pontos de atenção

- o README original estava vazio e agora passa a documentar o projeto;
- o branding principal está padronizado como `FitFlow`;
- o arquivo de testes atual tem apenas um teste de exemplo;
- por depender de Supabase, IA e push, parte do produto exige configuração externa para funcionar por completo.

## Scripts Disponíveis

```bash
npm run dev
npm run build
npm run build:dev
npm run lint
npm run preview
npm run test
npm run test:watch
```

## Resumo Executivo

FitFlow é uma plataforma fitness mobile-first com forte foco em:

- consistência;
- execução fluida;
- progresso mensurável;
- motivação assistida por IA;
- camada social competitiva;
- estética premium.

Hoje o projeto já cobre praticamente toda a espinha dorsal de um produto fitness moderno:

- autenticação;
- onboarding;
- treino;
- biblioteca;
- analytics;
- metas;
- medalhas;
- social;
- desafios;
- compartilhamento;
- notificações;
- PWA;
- IA.

Se a intenção for evoluir o produto, este repositório já tem base suficiente para continuar em direção a:

- beta fechado;
- lançamento mobile web/PWA;
- expansão de features premium;
- maturação de analytics e personalização.
