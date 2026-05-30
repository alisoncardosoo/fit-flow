import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ===========================================
// Admin authentication + RBAC (Role Based Access Control)
// ---------------------------------------------
// Autenticação REAL via Supabase Auth. O acesso ao painel é concedido
// apenas a usuários que possuem um papel administrativo na tabela
// public.user_roles (super_admin, admin, editor, support).
//
// A senha é gerenciada pelo Supabase Auth (hash no backend) — nunca fica
// no frontend. Veja ADMIN_SETUP.md para criar o usuário admin inicial.
// ===========================================

export type AdminRole = "super_admin" | "admin" | "editor" | "support";

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  roles: AdminRole[];
}

export const roleLabel: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  support: "Suporte",
};

// Capabilities por papel — base para RBAC granular. As telas chamam
// `can(roles, "users:write")` para liberar ações conforme o produto cresce.
export type Permission =
  | "dashboard:view"
  | "users:view"
  | "users:write"
  | "workouts:write"
  | "exercises:write"
  | "subscriptions:view"
  | "notifications:send"
  | "coupons:write"
  | "support:handle"
  | "settings:write";

const ALL: Permission[] = [
  "dashboard:view", "users:view", "users:write", "workouts:write",
  "exercises:write", "subscriptions:view", "notifications:send",
  "coupons:write", "support:handle", "settings:write",
];

const rolePermissions: Record<AdminRole, Permission[]> = {
  super_admin: ALL,
  admin: ALL.filter((p) => p !== "settings:write"),
  editor: ["dashboard:view", "users:view", "workouts:write", "exercises:write"],
  support: ["dashboard:view", "users:view", "support:handle"],
};

/** True se QUALQUER um dos papéis do usuário concede a permissão. */
export function can(roles: AdminRole[], perm: Permission): boolean {
  return roles.some((r) => rolePermissions[r]?.includes(perm));
}

/** Papel "mais alto" para exibição. */
export function primaryRole(roles: AdminRole[]): AdminRole | null {
  const order: AdminRole[] = ["super_admin", "admin", "editor", "support"];
  return order.find((r) => roles.includes(r)) ?? null;
}

export class AdminAuthError extends Error {}

// ---------------------------------------------
// Ações de autenticação
// ---------------------------------------------

/** Faz login via Supabase e valida que o usuário tem papel administrativo. */
export async function adminSignIn(email: string, password: string): Promise<AdminAccount> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    throw new AdminAuthError("E-mail ou senha inválidos");
  }

  const roles = await fetchRoles();
  if (roles.length === 0) {
    // Usuário existe, mas não é staff — bloqueia e desfaz a sessão.
    await supabase.auth.signOut();
    throw new AdminAuthError("Esta conta não tem acesso ao painel administrativo");
  }

  return toAccount(data.session, roles);
}

export async function adminSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Envia e-mail de redefinição de senha pelo Supabase. */
export async function adminRequestPasswordReset(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) throw new AdminAuthError("Informe um e-mail válido");

  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
  if (error) throw new AdminAuthError(error.message);
}

// ---------------------------------------------
// Helpers internos
// ---------------------------------------------
async function fetchRoles(): Promise<AdminRole[]> {
  const { data, error } = await supabase.rpc("get_my_roles");
  if (error || !data) return [];
  return data as AdminRole[];
}

function toAccount(session: Session | null, roles: AdminRole[]): AdminAccount {
  const user = session?.user;
  const meta = (user?.user_metadata ?? {}) as { display_name?: string };
  return {
    id: user?.id ?? "",
    email: user?.email ?? "",
    name: meta.display_name || user?.email?.split("@")[0] || "Admin",
    roles,
  };
}

// ---------------------------------------------
// Hook de sessão administrativa
// ---------------------------------------------
export interface AdminAuthState {
  account: AdminAccount | null;
  loading: boolean;
}

/**
 * Observa a sessão Supabase e resolve os papéis do usuário. Retorna
 * `account` apenas quando o usuário é staff; caso contrário, null.
 */
export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({ account: null, loading: true });

  useEffect(() => {
    let active = true;

    const resolve = async (session: Session | null) => {
      if (!session?.user) {
        if (active) setState({ account: null, loading: false });
        return;
      }
      const roles = await fetchRoles();
      if (!active) return;
      setState({
        account: roles.length > 0 ? toAccount(session, roles) : null,
        loading: false,
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      // Adia a chamada RPC para fora do callback (recomendação do Supabase).
      setTimeout(() => void resolve(session), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => resolve(session));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
