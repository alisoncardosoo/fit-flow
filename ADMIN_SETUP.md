# Painel Administrativo — Setup

O painel `/admin` do Fit Flow usa **dados reais do Supabase**, com autenticação
própria via Supabase Auth e controle de acesso por papéis (RBAC).

Para colocá-lo no ar, são **dois passos**: aplicar a migração e criar o usuário admin.

---

## 1. Aplicar a migração

A migração `supabase/migrations/20260530190547_admin_panel_rbac_and_business_tables.sql`
cria toda a estrutura: RBAC (`user_roles`), políticas RLS para admins, tabelas de
negócio (`plans`, `subscriptions`, `subscription_events`, `coupons`,
`support_tickets`, `notification_campaigns`, `app_settings`) e as RPCs de analytics.

### Opção A — Supabase CLI (recomendado)

```bash
supabase db push
```

### Opção B — SQL Editor

Abra o [SQL Editor](https://supabase.com/dashboard/project/ebnoiynvjpdcuomblwzv/sql)
do projeto, cole o conteúdo do arquivo de migração e execute.

---

## 2. Criar o usuário administrador

### 2.1 Criar a conta de autenticação

No Dashboard do Supabase → **Authentication → Users → Add user**:

- **Email:** `admin@fitflow.com.br`
- **Password:** `#Teste123`
- **Auto Confirm User:** ✅ (ligado)

> Em produção, troque essa senha por uma forte. A senha é gerenciada e
> hasheada pelo Supabase Auth — nunca fica no frontend.

### 2.2 Atribuir o papel `super_admin`

No **SQL Editor**, execute:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'admin@fitflow.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
```

Pronto. Acesse **`/admin/login`** e entre com as credenciais acima.

---

## Papéis disponíveis (RBAC)

| Papel         | Acesso                                                        |
|---------------|---------------------------------------------------------------|
| `super_admin` | Tudo, incluindo configurações                                 |
| `admin`       | Tudo, exceto configurações da plataforma                      |
| `editor`      | Dashboard, usuários (leitura), treinos e exercícios           |
| `support`     | Dashboard, usuários (leitura) e suporte                       |

Para conceder acesso a outro usuário, repita o passo 2.2 trocando o e-mail e o
papel desejado (`'admin'`, `'editor'` ou `'support'`).

---

## O que é dado real vs. o que começa vazio

**Dado real (já populado pela base de usuários):**
- Dashboard (KPIs, crescimento, engajamento)
- Usuários (lista, filtros, último acesso, streak)
- Treinos (alunos usando, conclusões)
- Exercícios (banco público com filtros e preview)
- Analytics (treinos iniciados/concluídos, exercícios mais/menos usados)
- Retenção (usuários em risco, streaks)

**Começa vazio (tabelas criadas, prontas para uso):**
- Assinaturas / Receita — popula quando você conectar Stripe / Mercado Pago
  (as tabelas `subscriptions` e `subscription_events` já recebem os webhooks)
- Cupons — crie pelo próprio painel (persiste no banco)
- Suporte — tickets abertos pelos usuários no app aparecem aqui
- Notificações — campanhas criadas pelo painel ficam registradas
- Configurações — salvas em `app_settings`

---

## Próximos passos sugeridos

1. **Gateways de pagamento:** criar Edge Functions de webhook do Stripe /
   Mercado Pago que inserem em `subscriptions` + `subscription_events`.
2. **Ações de usuário:** ligar "bloquear/resetar senha" a chamadas admin do
   Supabase (requer service role numa Edge Function — nunca no frontend).
3. **Envio real de push:** conectar o composer de notificações à função
   `send-push` já existente no projeto.
