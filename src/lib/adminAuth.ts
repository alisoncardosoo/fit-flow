import { useSyncExternalStore } from "react";

// ===========================================
// Admin authentication + RBAC (Role Based Access Control)
// ---------------------------------------------
// Frontend-only demo auth for the Fit Flow admin panel. Credentials are
// hardcoded ONLY for demonstration/development.
//
// ⚠️ PRODUÇÃO: as credenciais devem ser validadas no backend, com a senha
// armazenada como hash (bcrypt/argon2) e nunca embutida no frontend. Esta
// camada deve ser substituída por uma chamada autenticada à API/Supabase.
// ===========================================

export type AdminRole = "super_admin" | "admin" | "editor" | "support";

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export interface AdminSession {
  account: AdminAccount;
  /** Epoch ms when the session was issued. */
  issuedAt: number;
}

export const roleLabel: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  support: "Suporte",
};

// Capabilities per role — the foundation for fine-grained RBAC. Screens can
// call `can(role, "users:write")` to gate actions as the product grows.
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

export function can(role: AdminRole, perm: Permission): boolean {
  return rolePermissions[role]?.includes(perm) ?? false;
}

// ---------------------------------------------
// Demo credential store (replace with real backend in production).
// ---------------------------------------------
const DEMO_CREDENTIALS = [
  {
    email: "admin@fitflow.com.br",
    password: "#Teste123",
    account: {
      id: "adm_1",
      name: "Administrador",
      email: "admin@fitflow.com.br",
      role: "super_admin" as AdminRole,
    },
  },
];

const STORAGE_KEY = "fitflow.admin.session";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24; // 24h persistent session

// ---------------------------------------------
// Tiny external store so components stay in sync without a context provider.
// ---------------------------------------------
let current: AdminSession | null = readStored();
const listeners = new Set<() => void>();

function readStored(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (Date.now() - parsed.issuedAt > SESSION_MAX_AGE) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export class AdminAuthError extends Error {}

/** Validates demo credentials and persists the session. */
export async function adminSignIn(email: string, password: string): Promise<AdminSession> {
  // Simulate a network round-trip for realistic UX (loading states).
  await new Promise((r) => setTimeout(r, 600));

  const match = DEMO_CREDENTIALS.find(
    (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password,
  );
  if (!match) {
    throw new AdminAuthError("E-mail ou senha inválidos");
  }

  const session: AdminSession = { account: match.account, issuedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  current = session;
  emit();
  return session;
}

export function adminSignOut() {
  localStorage.removeItem(STORAGE_KEY);
  current = null;
  emit();
}

/** Simulated password-recovery request (no real e-mail is sent in demo). */
export async function adminRequestPasswordReset(email: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700));
  if (!email.trim()) throw new AdminAuthError("Informe um e-mail válido");
}

// React hook — returns the live admin session (or null).
export function useAdminAuth(): AdminSession | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
