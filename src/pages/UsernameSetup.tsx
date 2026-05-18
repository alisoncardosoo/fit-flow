import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AtSign, ArrowRight, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  isUsernameAvailable,
  setUsername,
  suggestUsername,
  validateUsernameFormat,
} from "@/lib/username";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export default function UsernameSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const checkSeq = useRef(0);

  // Hydrate suggestion from profile/email (runs once when user is ready).
  useEffect(() => {
    if (!user || hydrated) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.username) {
        // Already has a handle — refresh the guard cache and bounce home.
        queryClient.setQueryData(["has-username", user.id], true);
        navigate("/", { replace: true });
        return;
      }
      const seed = data?.display_name ?? user.email?.split("@")[0] ?? "";
      setValue(suggestUsername(seed));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, hydrated, navigate, queryClient]);

  // Debounced availability check
  const validation = useMemo(() => validateUsernameFormat(value), [value]);
  useEffect(() => {
    if (!value) {
      setStatus("idle");
      setErrorMsg(null);
      return;
    }
    if (!validation.ok) {
      setStatus("invalid");
      setErrorMsg(validation.reason);
      return;
    }
    setStatus("checking");
    setErrorMsg(null);
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(validation.value);
        if (seq !== checkSeq.current) return;
        setStatus(ok ? "available" : "taken");
        if (!ok) setErrorMsg("Esse @ já está em uso.");
      } catch {
        if (seq !== checkSeq.current) return;
        setStatus("idle");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, validation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || status !== "available") return;
    setSaving(true);
    try {
      await setUsername(user.id, value);
      // Prime + invalidate the guard's cache so RequireAuth sees the new
      // username immediately and doesn't bounce us back to /username.
      queryClient.setQueryData(["has-username", user.id], true);
      await queryClient.invalidateQueries({ queryKey: ["has-username", user.id] });
      toast.success(`@${value} é seu agora 🔥`);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10 safe-top">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center gap-3 text-center"
        >
          <div className="rounded-3xl bg-primary p-4 glow-primary">
            <AtSign className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="pill mt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Crie seu @
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Escolha seu nome de usuário
          </h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Seu @ identifica você no ranking, nos cards compartilhados e para os amigos.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="card-premium rounded-3xl p-6"
        >
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Seu @
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
              @
            </span>
            <Input
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              maxLength={20}
              placeholder="seu_nome"
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              className="h-14 rounded-2xl border-border bg-secondary pl-9 pr-12 text-base font-semibold tracking-wide"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {status === "available" && <Check className="h-5 w-5 text-success" />}
              {(status === "taken" || status === "invalid") && (
                <X className="h-5 w-5 text-destructive" />
              )}
            </div>
          </div>

          <div className="mt-2 min-h-[1.25rem] text-xs">
            {errorMsg ? (
              <span className="text-destructive">{errorMsg}</span>
            ) : status === "available" ? (
              <span className="font-semibold text-success">@{value} está disponível</span>
            ) : (
              <span className="text-muted-foreground">
                3 a 20 caracteres · letras, números, "_" ou "."
              </span>
            )}
          </div>

          <Button
            type="submit"
            disabled={status !== "available" || saving}
            className="mt-6 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary disabled:opacity-40"
          >
            {saving ? "Salvando…" : "Continuar"}
            <ArrowRight className="ml-1 h-5 w-5" />
          </Button>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Você só pode definir uma vez por aqui — depois, edite no Perfil.
          </p>
        </motion.form>
      </div>
    </div>
  );
}
