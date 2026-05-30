import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Activity,
  CreditCard,
  Bell,
  TrendingUp,
  HeartPulse,
  Ticket,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

// Single source of truth for the admin sidebar + mobile drawer.
export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard, end: true },
  { label: "Usuários", to: "/admin/users", icon: Users },
  { label: "Treinos", to: "/admin/workouts", icon: Dumbbell },
  { label: "Exercícios", to: "/admin/exercises", icon: Activity },
  { label: "Assinaturas", to: "/admin/subscriptions", icon: CreditCard },
  { label: "Notificações", to: "/admin/notifications", icon: Bell },
  { label: "Analytics", to: "/admin/analytics", icon: TrendingUp },
  { label: "Retenção", to: "/admin/retention", icon: HeartPulse },
  { label: "Cupons", to: "/admin/coupons", icon: Ticket },
  { label: "Suporte", to: "/admin/support", icon: LifeBuoy },
  { label: "Configurações", to: "/admin/settings", icon: Settings },
];
