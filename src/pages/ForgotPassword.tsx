import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SupportDevCard } from "@/components/SupportDevCard";
import { resetPasswordRedirect } from "@/lib/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetPasswordRedirect(),
      });
      if (error) throw error;
      setSent(true);
      toast.success("Email enviado! Verifique sua caixa de entrada.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar email";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
      </div>

      <div className="safe-top safe-bottom relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
        <Link
          to="/auth"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para login
        </Link>

        <div className="flex flex-1 flex-col justify-center pb-4">
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
              Recuperação
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Esqueceu a senha<span className="text-primary">?</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviaremos um link para redefinir sua senha.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-premium rounded-3xl p-6"
        >
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Verifique seu email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enviamos um link para <span className="text-foreground">{email}</span>.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setSent(false)}
                variant="ghost"
                className="text-sm text-muted-foreground"
              >
                Não recebeu? Tentar novamente
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary"
              >
                {loading ? "Enviando…" : "Enviar link de recuperação"}
              </Button>
            </form>
          )}
        </motion.div>

        <SupportDevCard className="mt-8" />
        </div>
      </div>
    </div>
  );
}
