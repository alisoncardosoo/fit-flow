import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSignIn, AdminAuthError } from "@/lib/adminAuth";
import logo from "@/assets/logo.png";

interface FromState {
  from?: { pathname?: string };
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    (location.state as FromState | null)?.from?.pathname || "/admin/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminSignIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof AdminAuthError ? err.message : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <div className="relative hidden overflow-hidden bg-[hsl(140_8%_6%)] lg:block">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-primary/25 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <img src={logo} alt="FitFlow" className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-display text-xl font-bold tracking-tight">
              FitFlow<span className="text-primary">.</span>
            </span>
          </div>
          <div>
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
              Painel administrativo
              <br />
              <span className="text-primary">do seu negócio fitness.</span>
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Gestão de usuários, assinaturas, retenção e crescimento — tudo em um
              só lugar, com a performance de um SaaS premium.
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Acesso seguro e protegido por permissões
            </div>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 FitFlow. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-sm"
        >
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img src={logo} alt="FitFlow" className="h-14 w-14 rounded-2xl object-contain" />
          </div>

          <span className="pill mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Área administrativa
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse com suas credenciais de administrador.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@fitflow.com.br"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-2xl border-border bg-secondary pl-11 text-base"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl border-border bg-secondary px-11 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground transition hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary"
            >
              {loading ? "Entrando…" : "Entrar"}
              {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>

            <div className="text-center">
              <Link
                to="/admin/forgot-password"
                className="text-sm text-muted-foreground transition hover:text-primary"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          {/* Acesso inicial */}
          <div className="mt-6 rounded-xl border border-border/60 bg-secondary/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Acesso inicial</p>
            <p className="mt-1">
              E-mail: <span className="font-mono">admin@fitflow.com.br</span>
            </p>
            <p>
              Senha: <span className="font-mono">#Teste123</span>
            </p>
            <p className="mt-1.5 text-[11px]">
              Requer que o usuário admin tenha sido criado no Supabase (ver ADMIN_SETUP.md).
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
