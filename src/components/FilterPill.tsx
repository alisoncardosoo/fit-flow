import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useFilterDebug } from "@/lib/filterDebug";

/**
 * FilterPill — botão único de filtro usado em Workouts/Library/Goals.
 *
 * Design contém o glow/sombra do estado ativo dentro do próprio elemento usando
 * `isolate` + `relative`, e o background de destaque é aplicado via overlay
 * `absolute inset-0` arredondado. Isso garante que NUNCA gere artefatos de
 * sombra/degradê com overflow em rolagem horizontal — mesmo dentro de
 * `overflow-x-auto`, qualquer "vazamento" fica restrito ao bounding box.
 */
type ButtonBase = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDragStart" | "onDragEnd" | "onDrag"
>;

export interface FilterPillProps extends ButtonBase {
  active: boolean;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ active, size = "md", icon, children, className, ...props }, ref) => {
    const debug = useFilterDebug();

    const sizeCls =
      size === "sm"
        ? "h-8 px-3 text-xs"
        : "h-10 px-4 text-xs";

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        data-filter-pill
        data-active={active ? "true" : "false"}
        className={cn(
          // Base
          "relative isolate inline-flex shrink-0 items-center justify-center gap-1.5",
          "rounded-full font-extrabold uppercase tracking-wider",
          "select-none whitespace-nowrap",
          // Importante: overflow-hidden contém qualquer ::before/::after de glow
          "overflow-hidden",
          // Cor base (sempre presente, evita FOUC entre estados)
          active
            ? "text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground",
          sizeCls,
          // Debug: outline vermelho no bbox real
          debug && "outline-dashed outline-2 outline-red-500/80 outline-offset-2",
          className,
        )}
        {...props}
      >
        {/* Background ativo: overlay absoluto, sempre dentro do bbox.
            Usar overlay separado evita sombras "caixadas" no scroll horizontal,
            pois o shadow-glow é posicionado APENAS quando active=true e fica
            isolado no z-stacking via `isolate` + `-z-10`. */}
        {active && (
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 -z-10 rounded-full bg-primary",
              // Glow contido: usar inset shadow + drop-shadow-md mantém o efeito
              // dentro do contêiner overflow-hidden, evitando o "quadrado" vazado.
              "shadow-[0_0_20px_hsl(var(--primary)/0.45)]",
            )}
          />
        )}

        {/* Debug: marcador da área do glow potencial */}
        {debug && active && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 -z-20 rounded-full border border-amber-400/70"
          />
        )}

        {icon}
        <span className="relative z-10 flex items-center gap-1.5">{children}</span>
      </motion.button>
    );
  },
);
FilterPill.displayName = "FilterPill";

/**
 * FilterPillsRow — container horizontal scroll-safe para uma lista de pills.
 *
 * Garante:
 * - `overflow-x-auto` com `no-scrollbar`
 * - `py-1` de respiro vertical para qualquer focus-ring/outline
 * - Margem negativa lateral compensada por padding (não corta o primeiro/último)
 * - `data-filter-row` para o overlay de debug destacar o container
 */
export const FilterPillsRow = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const debug = useFilterDebug();
    return (
      <div
        ref={ref}
        data-filter-row
        className={cn(
          "no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1.5",
          debug && "outline-dashed outline-2 outline-cyan-400/70",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
FilterPillsRow.displayName = "FilterPillsRow";
