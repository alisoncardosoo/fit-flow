import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/lib/adminAuth";
import { SplashScreen } from "@/components/SplashScreen";

/**
 * Route middleware: only renders children when an authenticated admin
 * (staff role) session exists, otherwise redirects to the admin login.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { account, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) return <SplashScreen />;
  if (!account) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/** Inverse guard for the login page — bounce authed admins to the dashboard. */
export function RedirectIfAdmin({ children }: { children: ReactNode }) {
  const { account, loading } = useAdminAuth();
  if (loading) return <SplashScreen />;
  if (account) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
