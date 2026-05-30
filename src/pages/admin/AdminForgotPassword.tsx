import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequestPasswordReset, AdminAuthError } from "@/lib/adminAuth";
import logo from "@/assets/logo.png";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminRequestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof AdminAuthError ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logo} alt="FitFlow" className="h-14 w-14 rounded-2xl object-contain" />
        </div>

        <div className="card-premium rounded-3xl p-6">
          {sent ? (
            <div className="flex flex-col items-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <h1 className="mt-4 font-display text-xl font-bold tracking-tight">
                Verifique seu e-mail
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Se houver uma conta para <span className="font-medium text-foreground">{email}</span>,
                enviamos as instruções para redefinir sua senha.
              </p>
              <Button asChild className="mt-6 h-11 w-full rounded-2xl bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                <Link to="/admin/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold tracking-tight">
                Recuperar acesso
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Informe seu e-mail e enviaremos um link para redefinir a senha.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="admin@fitflow.com.br"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl border-border bg-secondary pl-11 text-base"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? "Enviando…" : "Enviar link de recuperação"}
                </Button>
              </form>
            </>
          )}
        </div>

        <Link
          to="/admin/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>
      </motion.div>
    </div>
  );
}
