import { forwardRef } from "react";
import { Flame, Dumbbell, TrendingUp, Trophy } from "lucide-react";
import logo from "@/assets/logo.png";

export type ShareCardData = {
  displayName: string;
  streak: number;
  weekCount: number;
  weeklyTarget: number;
  totalVolume: number; // kg over selected period
  totalSessions: number;
  topPRs: Array<{ name: string; weight: number }>;
  periodLabel: string;
  quote?: string;
};

const MOTIVATIONAL_QUOTES = [
  "Disciplina vence motivação.",
  "Cada série conta. Cada rep importa.",
  "O ferro não mente.",
  "Hoje mais forte que ontem.",
  "Sem atalhos. Só repetições.",
  "Progresso é a única meta.",
  "Constância > intensidade.",
  "Você vs você de ontem.",
  "Quem treina, evolui.",
  "Suor é o investimento. Resultado é o juro.",
  "Pequenos ganhos, todos os dias.",
  "Foco no processo. O resto vem.",
  "Treino é meditação em movimento.",
  "Limites existem para serem quebrados.",
  "Disciplina é liberdade.",
];

export function pickRandomQuote(seed?: string): string {
  if (!seed) return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return MOTIVATIONAL_QUOTES[Math.abs(h) % MOTIVATIONAL_QUOTES.length];
}

/**
 * 1080x1920 (9:16) Instagram story card. Renders inside a scaled wrapper for preview.
 */
export const ShareCard = forwardRef<HTMLDivElement, { data: ShareCardData }>(({ data }, ref) => {
  const volumeT = (data.totalVolume / 1000).toFixed(1);
  const weekPct = Math.min(100, Math.round((data.weekCount / Math.max(1, data.weeklyTarget)) * 100));

  return (
    <div
      ref={ref}
      className="relative overflow-hidden font-[Inter,sans-serif] text-white"
      style={{
        width: 1080,
        height: 1920,
        background:
          "radial-gradient(ellipse at 30% 0%, hsl(80 100% 70% / 0.35), transparent 55%), radial-gradient(ellipse at 80% 100%, hsl(140 80% 60% / 0.22), transparent 60%), linear-gradient(180deg, hsl(0 0% 5%) 0%, hsl(0 0% 3%) 100%)",
      }}
    >
      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative flex h-full flex-col p-20">
        {/* Brand header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-3xl overflow-hidden"
              style={{ boxShadow: "0 0 60px hsl(80 100% 70% / 0.5)" }}
            >
              <img src={logo} alt="FitFlow" className="h-full w-full object-contain" crossOrigin="anonymous" />
            </div>
            <div className="font-[Space_Grotesk,sans-serif] text-5xl font-bold tracking-tight">FitFlow</div>
          </div>
          <div className="text-right">
            <div className="text-2xl uppercase tracking-[0.3em] text-white/50">Evolução</div>
            <div className="mt-2 text-3xl font-semibold text-white/80">{data.periodLabel}</div>
          </div>
        </div>

        {/* Hero: streak */}
        <div className="mt-24 flex flex-col items-center text-center">
          <div className="flex items-center gap-6">
            <Flame className="h-32 w-32" style={{ color: "hsl(38 95% 60%)" }} strokeWidth={2.2} />
            <div
              className="font-[Space_Grotesk,sans-serif] text-[260px] font-black leading-none"
              style={{ color: "hsl(80 100% 70%)" }}
            >
              {data.streak}
            </div>
          </div>
          <div className="mt-2 text-5xl font-bold uppercase tracking-[0.2em] text-white/80">
            {data.streak === 1 ? "Dia consecutivo" : "Dias consecutivos"}
          </div>
          <div className="mt-6 text-3xl text-white/50">@{data.displayName}</div>
        </div>

        {/* Stats row */}
        <div className="mt-24 grid grid-cols-2 gap-6">
          <StatBlock
            icon={<TrendingUp className="h-12 w-12" />}
            label="Volume"
            value={`${volumeT}t`}
            sub="movidos"
          />
          <StatBlock
            icon={<Dumbbell className="h-12 w-12" />}
            label="Treinos"
            value={`${data.totalSessions}`}
            sub="completos"
          />
        </div>

        {/* Week progress */}
        <div className="mt-8 rounded-[40px] border border-white/10 bg-white/[0.04] p-10">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-semibold uppercase tracking-wider text-white/60">Semana atual</div>
            <div className="font-[Space_Grotesk,sans-serif] text-5xl font-bold">
              {data.weekCount}/{data.weeklyTarget}
            </div>
          </div>
          <div className="mt-6 h-5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${weekPct}%`,
                background: "linear-gradient(90deg, hsl(80 100% 70%), hsl(140 80% 60%))",
                boxShadow: "0 0 30px hsl(80 100% 70% / 0.6)",
              }}
            />
          </div>
        </div>

        {/* PRs */}
        {data.topPRs.length > 0 && (
          <div className="mt-8 rounded-[40px] border border-white/10 bg-white/[0.04] p-10">
            <div className="mb-6 flex items-center gap-4">
              <Trophy className="h-10 w-10" style={{ color: "hsl(80 100% 70%)" }} />
              <span className="text-3xl font-semibold uppercase tracking-wider text-white/60">Recordes</span>
            </div>
            <div className="space-y-5">
              {data.topPRs.slice(0, 3).map((pr) => (
                <div key={pr.name} className="flex items-center justify-between">
                  <span className="text-4xl font-medium text-white/90 line-clamp-1 pr-6">{pr.name}</span>
                  <span
                    className="font-[Space_Grotesk,sans-serif] text-5xl font-bold whitespace-nowrap"
                    style={{ color: "hsl(80 100% 70%)" }}
                  >
                    {pr.weight}kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motivational quote */}
        <div className="mt-8 rounded-[40px] border border-white/10 bg-white/[0.03] px-10 py-8 text-center">
          <div
            className="font-[Space_Grotesk,sans-serif] text-[44px] font-bold leading-tight"
            style={{ color: "hsl(80 100% 70%)" }}
          >
            "{data.quote ?? pickRandomQuote(data.displayName + data.periodLabel)}"
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between">
          <div className="text-2xl text-white/40">Seu fluxo. Sua evolução.</div>
          <div className="rounded-full border border-white/15 px-6 py-3 text-2xl font-semibold uppercase tracking-[0.25em] text-white/70">
            fitflow
          </div>
        </div>
      </div>
    </div>
  );
});
ShareCard.displayName = "ShareCard";

function StatBlock({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[40px] border border-white/10 bg-white/[0.04] p-10">
      <div className="flex items-center gap-3 text-white/60">
        {icon}
        <span className="text-2xl font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-4 font-[Space_Grotesk,sans-serif] text-7xl font-black">{value}</div>
      <div className="mt-1 text-2xl text-white/40">{sub}</div>
    </div>
  );
}
