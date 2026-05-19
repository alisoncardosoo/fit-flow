import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for browser tooling
    console.error("[ErrorBoundary]", error, info);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-destructive/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 safe-top">
          <div className="rounded-3xl bg-destructive/15 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" strokeWidth={2.5} />
          </div>

          <span className="pill mt-6">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            Algo deu errado
          </span>

          <h1 className="mt-3 text-center font-display text-3xl font-bold tracking-tight">
            Tropeçamos aqui<span className="text-destructive">.</span>
          </h1>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Um erro inesperado interrompeu sua navegação. Já registramos o
            problema. Tente recarregar a tela ou voltar ao início.
          </p>

          {this.state.error?.message && (
            <pre className="mt-5 max-h-32 w-full overflow-auto rounded-2xl border border-border bg-card p-3 text-[11px] leading-snug text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}

          <div className="mt-6 flex w-full gap-3">
            <button
              onClick={this.handleHome}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold transition hover:border-primary/40"
            >
              <Home className="h-4 w-4" /> Início
            </button>
            <button
              onClick={this.handleReload}
              className="glow-primary flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" /> Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
