import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, UserPlus, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { findUserByCode, sendFriendRequest } from "@/lib/social";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SocialAdd() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();
  const [code, setCode] = useState<string>(urlCode?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if (urlCode && user && !autoTried) {
      setAutoTried(true);
      void handleSubmit(urlCode.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, user]);

  async function handleSubmit(rawCode?: string) {
    if (!user) return;
    const c = (rawCode ?? code).trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) {
      toast.error("Código inválido (6 caracteres)");
      return;
    }
    setBusy(true);
    try {
      const target = await findUserByCode(c);
      if (!target) {
        toast.error("Código não encontrado");
        return;
      }
      if (target.user_id === user.id) {
        toast.error("Esse código é o seu");
        return;
      }
      await sendFriendRequest(user.id, target.user_id);
      const label = target.username ? `@${target.username}` : target.display_name ?? "atleta";
      toast.success(`Convite enviado para ${label}!`, { icon: <Check /> });
      navigate("/social");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar convite";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate("/social")} className="rounded-xl bg-secondary p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold">Adicionar amigo</h1>
          <p className="text-xs text-muted-foreground">Insira o código de 6 caracteres</p>
        </div>
      </div>

      <div className="card-premium rounded-3xl p-6">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC123"
          maxLength={6}
          autoFocus
          className="h-16 rounded-2xl border-border/40 bg-secondary text-center font-display text-3xl font-extrabold tracking-[0.5em] uppercase"
        />
        <Button
          onClick={() => handleSubmit()}
          disabled={busy || code.length !== 6}
          className="mt-4 h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground"
        >
          <UserPlus className="mr-2 h-5 w-5" />
          {busy ? "Enviando..." : "Enviar convite"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Peça ao seu amigo para abrir <strong>Social</strong> e copiar o código dele.
        </p>
      </div>
    </div>
  );
}
