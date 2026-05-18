import { motion } from "framer-motion";
import { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: string | number;
}

export function PageHeader({ eyebrow, title, subtitle, actions, backTo }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-7 flex items-end justify-between gap-3"
    >
      <div className="flex min-w-0 items-end gap-3">
        {backTo !== undefined && (
          <button
            onClick={() => (typeof backTo === "string" ? navigate(backTo) : navigate(backTo as number))}
            aria-label="Voltar"
            className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition hover:bg-secondary/80"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <span className="pill mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {eyebrow}
            </span>
          )}
          <h1 className="font-display text-[34px] leading-[1] font-extrabold tracking-tight">
            {title}
            <span className="text-primary">.</span>
          </h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
