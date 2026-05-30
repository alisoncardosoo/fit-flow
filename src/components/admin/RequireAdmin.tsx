import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/lib/adminAuth";

/**
 * Route middleware: only renders children when an admin session exists,
 * otherwise redirects to the admin login (remembering the intended path).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const session = useAdminAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/** Inverse guard for the login page — bounce authed admins to the dashboard. */
export function RedirectIfAdmin({ children }: { children: ReactNode }) {
  const session = useAdminAuth();
  if (session) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
