import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireAuth, RedirectIfAuthed } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useWakeLock } from "@/hooks/useWakeLock";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import UsernameSetup from "./pages/UsernameSetup";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Workouts from "./pages/Workouts";
import WorkoutEdit from "./pages/WorkoutEdit";
import Execute from "./pages/Execute";
import Analytics from "./pages/Analytics";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Achievements from "./pages/Achievements";
import Goals from "./pages/Goals";
import ShareEvolution from "./pages/ShareEvolution";
import Social from "./pages/Social";
import SocialAdd from "./pages/SocialAdd";
import Challenges from "./pages/Challenges";
import ChallengeNew from "./pages/ChallengeNew";
import ChallengeDetail from "./pages/ChallengeDetail";
import FriendCompare from "./pages/FriendCompare";
import SupportDev from "./pages/SupportDev";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Mantém a tela ligada enquanto o app estiver aberto e visível
  useWakeLock(true);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner position="top-center" theme="dark" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<RedirectIfAuthed><Auth /></RedirectIfAuthed>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/username" element={<RequireAuth><UsernameSetup /></RequireAuth>} />

            <Route path="/execute/:id" element={<RequireAuth><Execute /></RequireAuth>} />
            <Route path="/workouts/:id" element={<RequireAuth><WorkoutEdit /></RequireAuth>} />

            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workouts" element={<Workouts />} />
              <Route path="/library" element={<Library />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/share" element={<ShareEvolution />} />
              <Route path="/social" element={<Social />} />
              <Route path="/social/add" element={<SocialAdd />} />
              <Route path="/social/invite/:code" element={<SocialAdd />} />
              <Route path="/social/compare/:friendId" element={<FriendCompare />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenges/new" element={<ChallengeNew />} />
              <Route path="/challenges/:id" element={<ChallengeDetail />} />
              <Route path="/support" element={<SupportDev />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
