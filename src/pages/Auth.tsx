import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { SupportDevCard } from "@/components/SupportDevCard";

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: APP_URL,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Vamos começar 🔥");
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate("/");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error(
        msg.includes("Invalid login") ? "Email ou senha incorretos" :
        msg.includes("already registered") ? "Esse email já tem cadastro" :
        msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="safe-top safe-bottom relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <img
            src={logo}
            alt="FitFlow"
            className="h-20 w-20 rounded-3xl object-contain"
          />

          <div className="flex flex-col items-center text-center">
            <span className="pill mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              FitFlow<span className="text-primary">.</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Seu fluxo. Sua evolução.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-premium rounded-3xl p-6"
        >
          <div className="mb-6 flex gap-2 rounded-2xl bg-secondary p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <Input
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-2xl border-border bg-secondary pl-4 text-base"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="email@exemplo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl border-border bg-secondary pl-11 text-base"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Senha"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl border-border bg-secondary pl-11 text-base"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary"
            >
              {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>

            {mode === "signin" && (
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground transition hover:text-primary"
                >
                  Esqueci minha senha
                </Link>
              </div>
            )}
          </form>
        </motion.div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ao continuar você concorda com os termos e a política de privacidade.
        </p>

        <SupportDevCard className="mt-6" />
      </div>
    </div>
  );
}
