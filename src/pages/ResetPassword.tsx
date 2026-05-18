import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, KeyRound, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SupportDevCard } from "@/components/SupportDevCard";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase puts a recovery token in the URL hash on redirect.
    // The client picks it up automatically and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Also check existing session in case the event already fired.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => {
        supabase.auth.signOut().then(() => navigate("/auth"));
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao redefinir senha";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col items-center gap-4"
        >
          <div className="rounded-3xl bg-primary p-4 glow-primary">
            <KeyRound className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="pill mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Redefinir
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Nova senha<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie uma senha forte para sua conta.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-premium rounded-3xl p-6"
        >
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="font-semibold">Senha atualizada!</p>
              <p className="text-sm text-muted-foreground">Redirecionando para login…</p>
            </div>
          ) : !ready ? (
            <div className="space-y-3 text-center text-sm text-muted-foreground">
              <p>Validando link de recuperação…</p>
              <p className="text-xs">
                Se você não chegou aqui por um link de email, peça um novo em{" "}
                <button
                  className="text-primary underline"
                  onClick={() => navigate("/forgot-password")}
                >
                  Esqueci a senha
                </button>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Nova senha"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl border-border bg-secondary pl-11 text-base"
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirmar nova senha"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 rounded-2xl border-border bg-secondary pl-11 text-base"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary"
              >
                {loading ? "Salvando…" : "Redefinir senha"}
              </Button>
            </form>
          )}
        </motion.div>

        <SupportDevCard className="mt-8" />
      </div>
    </div>
  );
}
