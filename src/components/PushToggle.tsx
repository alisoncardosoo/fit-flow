import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  enablePush,
  disablePush,
  getPushStatus,
  isPushSupported,
  type PushStatus,
} from "@/lib/webPush";

export function PushToggle() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      if (!isPushSupported()) {
        setStatus("unsupported");
        return;
      }
      setStatus(await getPushStatus(user.id));
    })();
  }, [user]);

  if (!user || status === "unsupported") return null;

  const enabled = status === "subscribed";

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePush(user.id);
        setStatus("idle");
        toast.success("Push desativado");
      } else {
        const next = await enablePush(user.id);
        setStatus(next);
        if (next === "subscribed") {
          toast.success("Push ativado! Você receberá @ menções e interações.");
        } else if (next === "denied") {
          toast.error("Permissão negada nas configurações do navegador.");
        } else {
          toast.error("Não foi possível ativar o push.");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar push";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : enabled ? BellRing : BellOff;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || status === "denied"}
      className="group relative flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 text-left transition hover:border-primary/40 hover:bg-card/80 disabled:opacity-60"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 transition ${
            enabled
              ? "bg-primary/15 text-primary ring-primary/25"
              : "bg-secondary text-muted-foreground ring-border/60"
          }`}
        >
          <Icon className={`h-5 w-5 ${busy ? "animate-spin" : ""}`} />
        </div>
        <div>
          <p className="text-sm font-bold">Notificações push</p>
          <p className="text-xs text-muted-foreground">
            {status === "denied"
              ? "Bloqueado no navegador. Habilite nas configurações do site."
              : enabled
              ? "Ativadas — você recebe alertas com @username em tempo real"
              : "Receba @menções e interações sociais mesmo com o app fechado"}
          </p>
        </div>
      </div>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
          enabled ? "bg-primary" : "bg-secondary"
        }`}
        aria-hidden
      >
        <span
          className={`h-5 w-5 rounded-full bg-background shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
