import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@/components/SplashScreen";
import { loadUserImageOverrides } from "@/lib/exerciseImageCache";

const ALLOWED_WITHOUT_USERNAME = ["/username", "/onboarding"];

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const { data: hasUsername, isLoading: checkingUsername } = useQuery({
    queryKey: ["has-username", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data?.username;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (user) void loadUserImageOverrides();
  }, [user]);

  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  // Wait for the username check before rendering protected pages.
  if (checkingUsername) return <SplashScreen />;

  if (
    hasUsername === false &&
    !ALLOWED_WITHOUT_USERNAME.some((p) => location.pathname.startsWith(p))
  ) {
    return <Navigate to="/username" replace />;
  }

  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
