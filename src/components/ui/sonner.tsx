import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Global toast configuration.
 *
 * - `position="top-center"` with safe-area offset injected via CSS variable
 *   so the toast never sits behind the iPhone notch / Dynamic Island.
 * - `duration={5000}` gives users enough time to read short messages.
 *   Use `toast.xxx(msg, { duration: N })` for one-offs that need longer.
 * - High-contrast styling using semantic tokens (no raw colors).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={5000}
      visibleToasts={3}
      offset="calc(env(safe-area-inset-top, 0px) + 56px)"
      mobileOffset="calc(env(safe-area-inset-top, 0px) + 56px)"
      style={
        {
          // Fallback for older sonner versions that read the CSS var.
          "--offset": "calc(env(safe-area-inset-top, 0px) + 56px)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-elevated group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-sm group-[.toaster]:font-medium group-[.toaster]:rounded-2xl group-[.toaster]:px-4 group-[.toaster]:py-3.5",
          title: "group-[.toast]:text-foreground group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!border-primary/40",
          error: "group-[.toaster]:!border-destructive/50",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
