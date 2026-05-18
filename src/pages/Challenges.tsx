import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Plus, Calendar, Users, Flame } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  listMyChallenges, type ChallengeWithMeta,
  CHALLENGE_TYPE_LABEL, CHALLENGE_TYPE_UNIT,
} from "@/lib/challenges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ChallengeWithMeta[] | null>(null);

  useEffect(() => { if (user) void load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    if (!user) return;
    try {
      const list = await listMyChallenges(user.id);
      setItems(list);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar desafios");
      setItems([]);
    }
  }

  const now = new Date();
  const active = (items ?? []).filter((c) => isAfter(new Date(c.ends_at), now));
  const past = (items ?? []).filter((c) => !isAfter(new Date(c.ends_at), now));

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow="Compita com amigos"
        title="Desafios"
        subtitle="Bata metas e dispute o pódio"
        backTo="/social"
        actions={
          <Button onClick={() => navigate("/challenges/new")} size="sm" className="rounded-full bg-primary text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        }
      />

      {items === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card-premium rounded-3xl p-8 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="mb-4 text-sm text-muted-foreground">Nenhum desafio ainda. Crie o primeiro!</p>
          <Button onClick={() => navigate("/challenges/new")} className="rounded-full bg-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Criar desafio
          </Button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Em andamento</h2>
              <div className="space-y-3">
                {active.map((c) => <ChallengeItem key={c.id} c={c} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Encerrados</h2>
              <div className="space-y-3 opacity-70">
                {past.map((c) => <ChallengeItem key={c.id} c={c} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ChallengeItem({ c }: { c: ChallengeWithMeta }) {
  const ends = new Date(c.ends_at);
  const isActive = isAfter(ends, new Date());
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link to={`/challenges/${c.id}`} className="card-premium block rounded-3xl p-5 transition active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-500">
                <Flame className="h-3 w-3" /> {CHALLENGE_TYPE_LABEL[c.type]}
              </span>
              {c.is_joined && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Participando
                </span>
              )}
            </div>
            <h3 className="mt-1.5 font-display text-base font-extrabold leading-tight">{c.title}</h3>
            {c.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {c.participant_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {isActive
              ? `Termina ${formatDistanceToNow(ends, { addSuffix: true, locale: ptBR })}`
              : `Encerrado ${format(ends, "dd/MM")}`}
          </span>
          {c.is_joined && (
            <span className="ml-auto font-display font-extrabold text-foreground">
              {Math.round(c.my_score).toLocaleString("pt-BR")} {CHALLENGE_TYPE_UNIT[c.type]}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
