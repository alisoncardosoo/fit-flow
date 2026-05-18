import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  createChallenge, CHALLENGE_TYPE_LABEL,
  type ChallengeType, type ChallengePeriod,
} from "@/lib/challenges";
import { loadFriends, type Friend } from "@/lib/social";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const TYPE_OPTIONS: ChallengeType[] = ["most_sessions", "most_volume", "most_frequency"];
const PERIOD_OPTIONS: { value: ChallengePeriod; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "custom", label: "Personalizado" },
];

export default function ChallengeNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChallengeType>("most_sessions");
  const [period, setPeriod] = useState<ChallengePeriod>("weekly");
  const [customDays, setCustomDays] = useState(7);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const f = await loadFriends(user.id);
      setFriends(f.filter((x) => x.status === "accepted"));
    })();
  }, [user]);

  function toggleInvite(id: string) {
    setInvited((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function handleCreate() {
    if (!user || !title.trim()) { toast.error("Dê um título ao desafio"); return; }
    setLoading(true);
    try {
      const id = await createChallenge({
        creator_id: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        period,
        custom_days: customDays,
        invite_friend_ids: Array.from(invited),
      });
      toast.success("Desafio criado!");
      navigate(`/challenges/${id}`, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar desafio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Novo desafio</h1>
          <p className="text-xs text-muted-foreground">Convide seus amigos para competir</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Quem treina mais essa semana"
            maxLength={60}
            className="rounded-xl"
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Regras, prêmio…"
            maxLength={200}
            rows={2}
            className="rounded-xl"
          />
        </div>

        <div>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</Label>
          <div className="grid grid-cols-1 gap-2">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  type === t ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/50"
                }`}
              >
                <Trophy className={`h-5 w-5 ${type === t ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-bold">{CHALLENGE_TYPE_LABEL[t]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Período</Label>
          <div className="grid grid-cols-3 gap-2">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`rounded-xl border p-3 text-sm font-bold transition ${
                  period === p.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="mt-3 flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Duração</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={customDays}
                onChange={(e) => setCustomDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                className="w-20 rounded-xl"
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          )}
        </div>

        <div>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Convidar amigos {invited.size > 0 && `(${invited.size})`}
          </Label>
          {friends.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Você ainda não tem amigos. O desafio será só para você por enquanto.
            </p>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <label
                  key={f.user_id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={invited.has(f.user_id)}
                    onCheckedChange={() => toggleInvite(f.user_id)}
                  />
                  <span className="flex-1 font-bold">{f.display_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={handleCreate}
          disabled={loading || !title.trim()}
          className="w-full rounded-full bg-primary text-primary-foreground"
        >
          {loading ? "Criando…" : "Criar desafio"}
        </Button>
      </div>
    </div>
  );
}
