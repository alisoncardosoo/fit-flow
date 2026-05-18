import { useState } from "react";
import { Instagram, Heart, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import nosLogo from "@/assets/nos-logo.png";
import pixQr from "@/assets/pix-qr.png";

type Props = {
  variant?: "compact" | "full";
  className?: string;
};

const PIX_KEY = "24.233.005/0001-22";
const PIX_KEY_RAW = "24233005000122";

/**
 * Cartão "Apoie o Dev" — exibe a marca Nós Code, link para Instagram,
 * chave PIX (CNPJ) copiável e QR Code para doação.
 * - `compact`: linha sutil para rodapés (login, perfil)
 * - `full`: card completo usado na página /support
 */
export function SupportDevCard({ variant = "compact", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  if (variant === "compact") {
    return (
      <a
        href="https://www.instagram.com/nos.code/"
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex items-center justify-center gap-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground ${className}`}
      >
        <span>Criado por</span>
        <img
          src={nosLogo}
          alt="Nós Code"
          width={1080}
          height={361}
          className="h-4 w-auto opacity-60 transition group-hover:opacity-100"
          style={{ aspectRatio: "1080 / 361" }}
        />
        <Instagram className="h-3 w-3 opacity-60 transition group-hover:opacity-100" />
      </a>
    );
  }

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY_RAW);
      setCopied(true);
      toast.success("Chave PIX copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div
      className={`relative isolate overflow-hidden rounded-3xl border border-border/50 p-6 text-center ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(160px 160px at 50% -30px, hsl(var(--primary) / 0.18), transparent 70%), var(--gradient-card)",
      }}
    >
      {/* Logo Nós Code com proporção correta */}
      <div className="mx-auto mb-5 flex h-16 w-32 items-center justify-center rounded-2xl bg-background/60 backdrop-blur">
        <img
          src={nosLogo}
          alt="Nós Code"
          width={1080}
          height={361}
          className="h-8 w-auto"
          style={{ aspectRatio: "1080 / 361" }}
        />
      </div>

      <h2 className="font-display text-2xl font-extrabold tracking-tight">
        Apoie o Dev <span aria-hidden>☕</span>
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
        Se o FitFlow te ajuda a evoluir nos treinos, considere pagar um cafézinho
        para o desenvolvedor. Cada contribuição faz diferença!
      </p>

      {/* Chave PIX */}
      <div className="mt-6 text-left">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Chave PIX (CNPJ)
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 p-2 pl-4">
          <span className="flex-1 truncate font-mono text-sm font-semibold tabular-nums">
            {PIX_KEY}
          </span>
          <button
            type="button"
            onClick={copyPix}
            aria-label="Copiar chave PIX"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground transition hover:bg-primary hover:text-primary-foreground active:scale-95"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div className="mt-6">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Ou escaneie o QR Code
        </p>
        <div className="mx-auto inline-flex rounded-2xl bg-white p-3 shadow-lg">
          <img
            src={pixQr}
            alt="QR Code PIX"
            width={220}
            height={220}
            className="h-44 w-44"
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Aponte a câmera do seu app de banco
        </p>
      </div>

      {/* Instagram */}
      <a
        href="https://www.instagram.com/nos.code/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-glow transition hover:bg-primary/90"
      >
        <Instagram className="h-4 w-4" />
        Seguir @nos.code
      </a>

      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Heart className="h-3.5 w-3.5 text-primary" />
        Obrigado pelo apoio!
      </div>
    </div>
  );
}
