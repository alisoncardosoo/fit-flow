import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Dumbbell, Calendar, Clock, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { getFriendComparison, type ComparisonRow } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RANGES = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

export default function FriendCompare() {
  const { friendId } = useParams<{ friendId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<ComparisonRow[] | null>(null);
  const [friendName, setFriendName] = useState("Amigo");

  useEffect(() => {
    if (!user || !friendId) return;
    void load();
    void (async () => {
      const { data } = await supabase.rpc("get_public_profiles", { _ids: [friendId] });
      const prof = (data as { user_id: string; display_name: string | null; username: string | null }[] | null)?.[0];
      setFriendName(prof?.username ? `@${prof.username}` : prof?.display_name ?? "Amigo");
    })();
    // eslint-disable-next-line
  }, [user, friendId, days]);

  async function load() {
    if (!user || !friendId) return;
    setRows(null);
    try {
      const data = await getFriendComparison(user.id, friendId, days);
      setRows(data);
    } catch (e) {
      console.error(e);
      setRows([]);
    }
  }

  const me = rows?.find((r) => r.user_id === user?.id);
  const friend = rows?.find((r) => r.user_id === friendId);

  const insight = (() => {
    if (!me || !friend) return null;
    const diff = me.total_volume - friend.total_volume;
    if (Math.abs(diff) < 100) return { text: "Vocês estão lado a lado 💪", positive: true };
    const pct = friend.total_volume === 0 ? 100 : Math.round((Math.abs(diff) / Math.max(friend.total_volume, 1)) * 100);
    if (diff > 0) return { text: `Você está ${pct}% à frente em volume`, positive: true };
    return { text: `${friendName} está ${pct}% à sua frente`, positive: false };
  })();

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow="Comparação"
        title={`Você vs ${friendName}`}
        backTo={-1}
      />

      <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))} className="mb-5">
        <TabsList className="grid w-full grid-cols-3 rounded-full bg-secondary p-1">
          {RANGES.map((r) => (
            <TabsTrigger
              key={r.value}
              value={String(r.value)}
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rows === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {insight && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`mb-5 flex items-center gap-3 rounded-2xl p-4 ${
                insight.positive ? "bg-primary/15 text-primary" : "bg-orange-500/15 text-orange-500"
              }`}
            >
              <TrendingUp className="h-5 w-5" />
              <p className="text-sm font-bold">{insight.text}</p>
            </motion.div>
          )}

          <div className="space-y-3">
            <CompareRow
              icon={<Dumbbell className="h-4 w-4" />}
              label="Volume total"
              unit="kg"
              me={Math.round(me?.total_volume ?? 0)}
              other={Math.round(friend?.total_volume ?? 0)}
              meName="Você"
              otherName={friendName}
            />
            <CompareRow
              icon={<Calendar className="h-4 w-4" />}
              label="Treinos concluídos"
              unit=""
              me={me?.sessions ?? 0}
              other={friend?.sessions ?? 0}
              meName="Você"
              otherName={friendName}
            />
            <CompareRow
              icon={<Calendar className="h-4 w-4" />}
              label="Frequência"
              unit="dias"
              me={me?.frequency_days ?? 0}
              other={friend?.frequency_days ?? 0}
              meName="Você"
              otherName={friendName}
            />
            <CompareRow
              icon={<Clock className="h-4 w-4" />}
              label="Duração média"
              unit="min"
              me={Math.round(me?.avg_duration_min ?? 0)}
              other={Math.round(friend?.avg_duration_min ?? 0)}
              meName="Você"
              otherName={friendName}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CompareRow({
  icon, label, unit, me, other, meName, otherName,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  me: number;
  other: number;
  meName: string;
  otherName: string;
}) {
  const max = Math.max(me, other, 1);
  const meWon = me >= other;
  return (
    <div className="card-premium rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="space-y-2.5">
        <Bar name={meName} value={me} max={max} unit={unit} highlight={meWon} accent="bg-primary" />
        <Bar name={otherName} value={other} max={max} unit={unit} highlight={!meWon} accent="bg-orange-500" />
      </div>
    </div>
  );
}

function Bar({
  name, value, max, unit, highlight, accent,
}: { name: string; value: number; max: number; unit: string; highlight: boolean; accent: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={`font-bold ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{name}</span>
        <span className={`font-display font-extrabold tabular-nums ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
          {value.toLocaleString("pt-BR")} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={`h-full rounded-full ${accent}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
