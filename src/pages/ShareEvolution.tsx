import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Share2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toPng } from "html-to-image";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareCard, type ShareCardData } from "@/components/ShareCard";
import { toast } from "sonner";

type Period = "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  week: "Últimos 7 dias",
  month: "Últimos 30 dias",
  all: "Total",
};

export default function ShareEvolution() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<ShareCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, period]);

  async function load() {
    if (!user) return;
    setLoading(true);

    const since = new Date();
    if (period === "week") since.setDate(since.getDate() - 7);
    else if (period === "month") since.setDate(since.getDate() - 30);
    else since.setFullYear(since.getFullYear() - 10);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      { data: profile },
      { data: streakData },
      { data: periodSessions },
      { data: weekSessions },
      { data: prSets },
    ] = await Promise.all([
      supabase.from("profiles").select("display_name, username, weekly_target").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_user_streak", { _user_id: user.id }),
      supabase.from("workout_sessions").select("id, total_volume").eq("user_id", user.id)
        .not("finished_at", "is", null).gte("started_at", since.toISOString()),
      supabase.from("workout_sessions").select("id").eq("user_id", user.id)
        .not("finished_at", "is", null).gte("started_at", weekAgo.toISOString()),
      supabase.from("set_logs").select("weight, exercise_id, exercises(name)")
        .eq("user_id", user.id).gt("weight", 0).order("weight", { ascending: false }).limit(200),
    ]);

    // Compute top PRs (max weight per exercise, top 3)
    const prMap = new Map<string, { name: string; weight: number }>();
    type SetRow = { weight: number; exercise_id: string; exercises: { name: string } | null };
    for (const row of (prSets as SetRow[] | null) ?? []) {
      const name = row.exercises?.name;
      const w = Number(row.weight);
      if (!name || !w) continue;
      const cur = prMap.get(row.exercise_id);
      if (!cur || cur.weight < w) prMap.set(row.exercise_id, { name, weight: w });
    }
    const topPRs = Array.from(prMap.values()).sort((a, b) => b.weight - a.weight).slice(0, 3);

    const totalVolume = (periodSessions ?? []).reduce((a, s) => a + Number(s.total_volume ?? 0), 0);

    // Prefer username (real handle); fallback to first name; then "atleta".
    const handle =
      profile?.username ??
      (profile?.display_name?.split(" ")[0]?.toLowerCase() ?? "atleta");

    setData({
      displayName: handle,
      streak: typeof streakData === "number" ? streakData : 0,
      weekCount: weekSessions?.length ?? 0,
      weeklyTarget: profile?.weekly_target ?? 4,
      totalVolume,
      totalSessions: periodSessions?.length ?? 0,
      topPRs,
      periodLabel: PERIOD_LABELS[period],
    });
    setLoading(false);
  }

  async function generateBlob(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      width: 1080,
      height: 1920,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: "#0a0a0a",
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function handleDownload() {
    setExporting(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Falha ao gerar imagem");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitflow-evolucao-${period}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Card baixado! 📸");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar a imagem");
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    setExporting(true);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], "fitflow-evolucao.png", { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Minha evolução no FitFlow",
          text: "Meu fluxo. Minha evolução. 🔥",
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fitflow-evolucao-${period}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info("Compartilhamento direto não suportado — imagem baixada");
      }
    } catch (e) {
      const err = e as Error;
      if (err.name !== "AbortError") {
        console.error(e);
        toast.error("Erro ao compartilhar");
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="px-5 safe-top pb-dock">
      <PageHeader
        eyebrow="Compartilhe sua jornada"
        title="Evolução"
        subtitle="Gere um card lindo para suas stories"
        backTo={-1}
      />

      {/* Period switcher */}
      <div className="mb-6 flex gap-2 rounded-2xl bg-secondary p-1">
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {p === "week" ? "Semana" : p === "month" ? "Mês" : "Total"}
          </button>
        ))}
      </div>

      {/* Preview */}
      {loading || !data ? (
        <Skeleton className="aspect-[9/16] w-full rounded-3xl" />
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          ref={(el) => {
            // dynamic scale so the 1080x1920 card fits the preview width
            if (!el) return;
            const w = el.clientWidth;
            const inner = el.firstElementChild as HTMLDivElement | null;
            if (inner) {
              const scale = w / 1080;
              inner.style.transform = `scale(${scale})`;
              el.style.height = `${1920 * scale}px`;
            }
          }}
          className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-border shadow-elevated bg-black"
        >
          <div
            className="origin-top-left"
            style={{ width: 1080, height: 1920 }}
          >
            <ShareCard ref={cardRef} data={data} />
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          onClick={handleDownload}
          disabled={loading || exporting}
          variant="secondary"
          className="h-14 rounded-2xl text-base font-semibold"
        >
          {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Download className="mr-1 h-5 w-5" /> Baixar</>}
        </Button>
        <Button
          onClick={handleShare}
          disabled={loading || exporting}
          className="h-14 rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 glow-primary"
        >
          {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Share2 className="mr-1 h-5 w-5" /> Compartilhar</>}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Resolução de exportação: 1080×1920 (formato stories)
      </p>
    </div>
  );
}
