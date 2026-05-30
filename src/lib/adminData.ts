// ===========================================
// Admin panel — rótulos (pt-BR) e formatadores compartilhados.
// ---------------------------------------------
// Os DADOS agora vêm do Supabase (ver src/services/admin.service.ts).
// Este arquivo concentra apenas mapeamentos de exibição e utilitários de
// formatação usados pelas telas do painel.
// ===========================================

// ---- Planos ----------------------------------------
export const planLabel: Record<string, string> = {
  free: "Gratuito",
  premium: "Premium",
  annual: "Anual",
};

export const planTone: Record<string, "primary" | "muted" | "success"> = {
  free: "muted",
  premium: "primary",
  annual: "success",
};

// ---- Status de assinatura/usuário ------------------
export const subStatusLabel: Record<string, string> = {
  active: "Ativo",
  trialing: "Trial",
  past_due: "Pendente",
  canceled: "Cancelado",
};

export const subStatusTone: Record<string, "success" | "warning" | "muted" | "destructive"> = {
  active: "success",
  trialing: "warning",
  past_due: "warning",
  canceled: "destructive",
};

// ---- Objetivos -------------------------------------
export const goalLabel: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  weight_loss: "Emagrecimento",
  conditioning: "Condicionamento",
  strength: "Força",
  endurance: "Resistência",
  health: "Saúde",
};

// ---- Grupos musculares -----------------------------
export const muscleLabel: Record<string, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraços",
  quads: "Quadríceps",
  hamstrings: "Posteriores",
  glutes: "Glúteos",
  calves: "Panturrilhas",
  core: "Core",
  cardio: "Cardio",
  full_body: "Corpo inteiro",
};

// ---- Dificuldade / equipamento ---------------------
export const difficultyLabel: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export const difficultyTone: Record<string, "success" | "warning" | "destructive"> = {
  beginner: "success",
  intermediate: "warning",
  advanced: "destructive",
};

export const equipmentLabel: Record<string, string> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  machine: "Máquina",
  cable: "Polia",
  bodyweight: "Peso corporal",
  kettlebell: "Kettlebell",
  band: "Elástico",
  other: "Outro",
};

// ---- Eventos de assinatura -------------------------
export const subEventLabel: Record<string, string> = {
  new: "Nova",
  renewal: "Renovação",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  canceled: "Cancelamento",
};

export const subEventTone: Record<string, "success" | "primary" | "warning" | "destructive" | "muted"> = {
  new: "success",
  renewal: "primary",
  upgrade: "success",
  downgrade: "warning",
  canceled: "destructive",
};

// ---- Cupons ----------------------------------------
export const couponTypeLabel: Record<string, string> = {
  percent: "Percentual",
  fixed: "Valor fixo",
  trial: "Trial estendido",
};

export function couponValueDisplay(type: string, value: number): string {
  if (type === "percent") return `${value}%`;
  if (type === "fixed") return fmtCurrency(value);
  return `${value} dias`;
}

// ---- Tickets ---------------------------------------
export const ticketStatusLabel: Record<string, string> = {
  open: "Aberto",
  pending: "Em andamento",
  resolved: "Resolvido",
};

export const ticketStatusTone: Record<string, "warning" | "primary" | "success"> = {
  open: "warning",
  pending: "primary",
  resolved: "success",
};

export const ticketPriorityLabel: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const ticketPriorityTone: Record<string, "muted" | "warning" | "destructive"> = {
  low: "muted",
  medium: "warning",
  high: "destructive",
  critical: "destructive",
};

export const channelLabel: Record<string, string> = {
  email: "E-mail",
  chat: "Chat",
  app: "App",
};

// ---- Sugestões de retenção (estáticas — heurísticas do produto) ----
export const retentionSuggestions = [
  { title: "Notificação push de reengajamento", desc: "Envie um lembrete personalizado para os usuários inativos há 3-7 dias.", impact: "Alto", icon: "bell" },
  { title: "Oferta de desconto para churn", desc: "Cupom de 30% para assinantes em risco de cancelamento.", impact: "Alto", icon: "tag" },
  { title: "E-mail de progresso semanal", desc: "Resumo de evolução para reativar usuários gratuitos.", impact: "Médio", icon: "mail" },
  { title: "Desafio comunitário", desc: "Crie um desafio de 7 dias para aumentar a frequência semanal.", impact: "Médio", icon: "trophy" },
];

export const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ---- Formatadores ----------------------------------
export const fmtCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Centavos -> moeda BRL. */
export const fmtCents = (cents: number) => fmtCurrency(cents / 100);

export const fmtNumber = (n: number) => n.toLocaleString("pt-BR");

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function relativeDays(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m === 1 ? "mês" : "meses"}`;
}

/** Rótulo curto de dia/mês a partir de uma data ISO (para eixos de gráfico). */
export function shortDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shortMonth(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short" });
}
