// ===========================================
// Admin panel data layer
// ---------------------------------------------
// Centralized, typed mock data + helpers for the Fit Flow admin dashboard.
// All numbers are illustrative and meant to be swapped for real Supabase /
// Stripe / Mercado Pago queries later. Keeping it here means every admin
// screen reads from a single, consistent source of truth.
// ===========================================

export type Plan = "free" | "premium" | "annual";
export type UserStatus = "active" | "inactive" | "blocked" | "trial";
export type Goal =
  | "hypertrophy"
  | "weight_loss"
  | "conditioning"
  | "health"
  | "strength";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  goal: Goal;
  plan: Plan;
  status: UserStatus;
  createdAt: string; // ISO
  lastSeenAt: string; // ISO
  workouts: number;
  streak: number;
}

export interface AdminWorkout {
  id: string;
  name: string;
  category: WorkoutCategory;
  author: string;
  athletes: number; // alunos usando
  rating: number; // 0-5
  completions: number;
  archived: boolean;
  updatedAt: string;
}

export type WorkoutCategory =
  | "hypertrophy"
  | "weight_loss"
  | "cardio"
  | "mobility"
  | "stretching"
  | "home";

export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "glutes"
  | "fullbody";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface AdminExercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  equipment: string;
  difficulty: Difficulty;
  hasVideo: boolean;
  hasGif: boolean;
  uses: number;
}

export type SubscriptionEvent =
  | "new"
  | "renewal"
  | "upgrade"
  | "downgrade"
  | "canceled";

export interface AdminSubscription {
  id: string;
  user: string;
  email: string;
  plan: Plan;
  amount: number; // BRL / month equivalent
  event: SubscriptionEvent;
  gateway: "stripe" | "mercadopago";
  date: string;
}

export type CouponType = "percent" | "fixed" | "trial";

export interface AdminCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  uses: number;
  maxUses: number;
  active: boolean;
  expiresAt: string;
}

export type TicketStatus = "open" | "pending" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface AdminTicket {
  id: string;
  user: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  channel: "email" | "chat" | "app";
}

// ---------------------------------------------
// Localized label maps (pt-BR) — single source for chips/badges/filters.
// ---------------------------------------------

export const planLabel: Record<Plan, string> = {
  free: "Gratuito",
  premium: "Premium",
  annual: "Anual",
};

export const statusLabel: Record<UserStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
  trial: "Trial",
};

export const goalLabel: Record<Goal, string> = {
  hypertrophy: "Hipertrofia",
  weight_loss: "Emagrecimento",
  conditioning: "Condicionamento",
  health: "Saúde",
  strength: "Força",
};

export const categoryLabel: Record<WorkoutCategory, string> = {
  hypertrophy: "Hipertrofia",
  weight_loss: "Emagrecimento",
  cardio: "Cardio",
  mobility: "Mobilidade",
  stretching: "Alongamento",
  home: "Treino em casa",
};

export const muscleLabel: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  legs: "Pernas",
  shoulders: "Ombros",
  arms: "Braços",
  core: "Core",
  glutes: "Glúteos",
  fullbody: "Corpo inteiro",
};

export const difficultyLabel: Record<Difficulty, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export const subEventLabel: Record<SubscriptionEvent, string> = {
  new: "Nova",
  renewal: "Renovação",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  canceled: "Cancelamento",
};

// ---------------------------------------------
// Deterministic pseudo-random so the dashboard looks alive but stable
// across renders (no flicker between navigations).
// ---------------------------------------------

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const rand = seeded(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const FIRST = [
  "Ana", "Bruno", "Carla", "Diego", "Eduarda", "Felipe", "Gabriela", "Heitor",
  "Isabela", "João", "Karina", "Lucas", "Marina", "Nicolas", "Olívia", "Pedro",
  "Quésia", "Rafael", "Sofia", "Thiago", "Ursula", "Vitor", "Wesley", "Yara",
];
const LAST = [
  "Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa", "Almeida",
  "Ferreira", "Rodrigues", "Gomes", "Martins", "Araújo", "Barbosa", "Ribeiro",
];

function daysAgo(n: number) {
  const d = new Date("2026-05-30T12:00:00Z");
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const users: AdminUser[] = Array.from({ length: 64 }, (_, i) => {
  const first = pick(FIRST);
  const last = pick(LAST);
  const name = `${first} ${last}`;
  const plan = pick<Plan>(["free", "free", "premium", "premium", "annual"]);
  const status = pick<UserStatus>([
    "active", "active", "active", "inactive", "trial", "blocked",
  ]);
  const created = Math.floor(rand() * 400);
  return {
    id: `usr_${(1000 + i).toString()}`,
    name,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@email.com`,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${first}${last}&backgroundColor=cbff9a&textColor=1a1a1a`,
    goal: pick<Goal>([
      "hypertrophy", "weight_loss", "conditioning", "health", "strength",
    ]),
    plan,
    status,
    createdAt: daysAgo(created),
    lastSeenAt: daysAgo(Math.floor(rand() * Math.min(created, 45))),
    workouts: Math.floor(rand() * 240),
    streak: Math.floor(rand() * 60),
  };
});

const WORKOUT_NAMES = [
  "Push Pull Legs", "Full Body Express", "Hipertrofia Total", "Queima 360",
  "Cardio HIIT", "Mobilidade Diária", "Peito & Tríceps", "Costas & Bíceps",
  "Treino em Casa Sem Equipamento", "Glúteos de Aço", "Core Power",
  "Força Máxima", "Funcional Intenso", "Alongamento Completo", "Pernas Monstro",
];

export const workouts: AdminWorkout[] = WORKOUT_NAMES.map((name, i) => ({
  id: `wkt_${(200 + i).toString()}`,
  name,
  category: pick<WorkoutCategory>([
    "hypertrophy", "weight_loss", "cardio", "mobility", "stretching", "home",
  ]),
  author: pick(["Equipe FitFlow", "Coach Marina", "Coach Diego", "Coach Bruno"]),
  athletes: Math.floor(rand() * 1800) + 40,
  rating: Math.round((3.6 + rand() * 1.4) * 10) / 10,
  completions: Math.floor(rand() * 9000) + 100,
  archived: rand() > 0.85,
  updatedAt: daysAgo(Math.floor(rand() * 90)),
}));

const EXERCISE_NAMES: [string, MuscleGroup, string][] = [
  ["Supino Reto", "chest", "Barra"],
  ["Supino Inclinado", "chest", "Halteres"],
  ["Crucifixo", "chest", "Halteres"],
  ["Puxada Frontal", "back", "Polia"],
  ["Remada Curvada", "back", "Barra"],
  ["Levantamento Terra", "back", "Barra"],
  ["Agachamento Livre", "legs", "Barra"],
  ["Leg Press", "legs", "Máquina"],
  ["Cadeira Extensora", "legs", "Máquina"],
  ["Desenvolvimento", "shoulders", "Halteres"],
  ["Elevação Lateral", "shoulders", "Halteres"],
  ["Rosca Direta", "arms", "Barra"],
  ["Tríceps Corda", "arms", "Polia"],
  ["Prancha", "core", "Peso corporal"],
  ["Abdominal Supra", "core", "Peso corporal"],
  ["Elevação Pélvica", "glutes", "Barra"],
  ["Afundo", "legs", "Halteres"],
  ["Burpee", "fullbody", "Peso corporal"],
  ["Mountain Climber", "fullbody", "Peso corporal"],
  ["Corrida", "fullbody", "Esteira"],
];

export const exercises: AdminExercise[] = EXERCISE_NAMES.map(
  ([name, muscle, equipment], i) => ({
    id: `exr_${(500 + i).toString()}`,
    name,
    muscle,
    equipment,
    difficulty: pick<Difficulty>(["beginner", "intermediate", "advanced"]),
    hasVideo: rand() > 0.3,
    hasGif: rand() > 0.2,
    uses: Math.floor(rand() * 12000) + 200,
  }),
);

export const subscriptions: AdminSubscription[] = Array.from(
  { length: 28 },
  (_, i) => {
    const u = pick(users);
    const plan = pick<Plan>(["premium", "premium", "annual"]);
    return {
      id: `sub_${(800 + i).toString()}`,
      user: u.name,
      email: u.email,
      plan,
      amount: plan === "annual" ? 24.9 : 29.9,
      event: pick<SubscriptionEvent>([
        "new", "new", "renewal", "upgrade", "downgrade", "canceled",
      ]),
      gateway: pick(["stripe", "mercadopago"]),
      date: daysAgo(Math.floor(rand() * 30)),
    };
  },
);

export const coupons: AdminCoupon[] = [
  { id: "cpn_1", code: "BEMVINDO20", type: "percent", value: 20, uses: 482, maxUses: 1000, active: true, expiresAt: daysAgo(-45) },
  { id: "cpn_2", code: "ANUAL50", type: "percent", value: 50, uses: 213, maxUses: 500, active: true, expiresAt: daysAgo(-12) },
  { id: "cpn_3", code: "TRIAL30", type: "trial", value: 30, uses: 1290, maxUses: 5000, active: true, expiresAt: daysAgo(-90) },
  { id: "cpn_4", code: "BLACKFRIDAY", type: "fixed", value: 15, uses: 980, maxUses: 980, active: false, expiresAt: daysAgo(180) },
  { id: "cpn_5", code: "INDIQUE10", type: "fixed", value: 10, uses: 56, maxUses: 2000, active: true, expiresAt: daysAgo(-300) },
];

export const tickets: AdminTicket[] = [
  { id: "tkt_1", user: "Ana Silva", subject: "App trava ao abrir — não consigo treinar", status: "open", priority: "critical", createdAt: daysAgo(0), channel: "app" },
  { id: "tkt_2", user: "Bruno Costa", subject: "Cobrança duplicada no cartão", status: "open", priority: "high", createdAt: daysAgo(1), channel: "email" },
  { id: "tkt_3", user: "Carla Lima", subject: "Como cancelo minha assinatura?", status: "pending", priority: "medium", createdAt: daysAgo(1), channel: "chat" },
  { id: "tkt_4", user: "Diego Souza", subject: "Sugestão: modo escuro no relatório", status: "pending", priority: "low", createdAt: daysAgo(2), channel: "app" },
  { id: "tkt_5", user: "Eduarda Gomes", subject: "Vídeo do exercício não carrega", status: "resolved", priority: "medium", createdAt: daysAgo(3), channel: "app" },
  { id: "tkt_6", user: "Felipe Martins", subject: "Quero trocar de plano", status: "resolved", priority: "low", createdAt: daysAgo(4), channel: "chat" },
];

// ---------------------------------------------
// Time series for charts
// ---------------------------------------------

export const userGrowth = Array.from({ length: 30 }, (_, i) => {
  const base = 3200 + i * 78;
  const noise = Math.floor(rand() * 60);
  const d = new Date("2026-05-30T00:00:00Z");
  d.setDate(d.getDate() - (29 - i));
  return {
    date: `${d.getUTCDate().toString().padStart(2, "0")}/${(d.getUTCMonth() + 1).toString().padStart(2, "0")}`,
    total: base + noise,
    novos: 40 + Math.floor(rand() * 70),
  };
});

export const revenueMonthly = [
  { mes: "Jun", receita: 18200, meta: 17000 },
  { mes: "Jul", receita: 21450, meta: 19000 },
  { mes: "Ago", receita: 23900, meta: 22000 },
  { mes: "Set", receita: 22100, meta: 24000 },
  { mes: "Out", receita: 27800, meta: 26000 },
  { mes: "Nov", receita: 34500, meta: 30000 },
  { mes: "Dez", receita: 41200, meta: 36000 },
  { mes: "Jan", receita: 38900, meta: 40000 },
  { mes: "Fev", receita: 44600, meta: 42000 },
  { mes: "Mar", receita: 49100, meta: 46000 },
  { mes: "Abr", receita: 52400, meta: 50000 },
  { mes: "Mai", receita: 58700, meta: 54000 },
];

export const planDistribution = [
  { name: "Gratuito", value: users.filter((u) => u.plan === "free").length, key: "free" as Plan },
  { name: "Premium", value: users.filter((u) => u.plan === "premium").length, key: "premium" as Plan },
  { name: "Anual", value: users.filter((u) => u.plan === "annual").length, key: "annual" as Plan },
];

// Engagement heatmap — 7 days x 24h buckets, value 0-100
export const engagementHeatmap = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => {
    // Peaks around 6-8h and 18-21h, dips overnight
    const morning = Math.exp(-((hour - 7) ** 2) / 6) * 70;
    const evening = Math.exp(-((hour - 19) ** 2) / 6) * 95;
    const weekend = day >= 5 ? 0.8 : 1;
    return Math.round((morning + evening) * weekend + rand() * 12);
  }),
);

export const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ---------------------------------------------
// Derived KPIs
// ---------------------------------------------

export function getKpis() {
  const total = 5740;
  const active = 3980;
  const newToday = 132;
  const subscribers = users.filter((u) => u.plan !== "free").length * 24; // scaled
  const mrr = 58700;
  const arr = mrr * 12;
  return {
    total: { value: total, delta: 8.2 },
    active: { value: active, delta: 5.4 },
    newToday: { value: newToday, delta: 12.1 },
    subscribers: { value: subscribers, delta: 6.7 },
    mrr: { value: mrr, delta: 9.3 },
    arr: { value: arr, delta: 11.5 },
    churn: { value: 3.4, delta: -0.6 },
    retention: { value: 78.5, delta: 2.1 },
  };
}

// Users at risk grouped by inactivity window
export function getAtRiskBuckets() {
  const now = new Date("2026-05-30T12:00:00Z").getTime();
  const dayMs = 86400000;
  const inactiveDays = (u: AdminUser) =>
    Math.floor((now - new Date(u.lastSeenAt).getTime()) / dayMs);
  const buckets = [
    { label: "Sem acesso há 3+ dias", min: 3, max: 7, color: "warning" },
    { label: "Sem acesso há 7+ dias", min: 7, max: 15, color: "warning" },
    { label: "Sem acesso há 15+ dias", min: 15, max: 30, color: "destructive" },
    { label: "Sem acesso há 30+ dias", min: 30, max: Infinity, color: "destructive" },
  ];
  return buckets.map((b) => ({
    ...b,
    users: users.filter((u) => {
      const d = inactiveDays(u);
      return d >= b.min && d < b.max && u.status !== "blocked";
    }),
  }));
}

// Streak cohorts — users currently on a streak of N+ days.
export function getStreakBuckets() {
  const thresholds = [7, 15, 30, 90];
  return thresholds.map((min) => ({
    min,
    label: `${min} dias+`,
    count: users.filter((u) => u.streak >= min).length,
  }));
}

export const retentionSuggestions = [
  { title: "Notificação push de reengajamento", desc: "Enviar lembrete personalizado para 184 usuários inativos há 3-7 dias.", impact: "Alto", icon: "bell" },
  { title: "Oferta de desconto para churn", desc: "Cupom de 30% para 42 assinantes em risco de cancelamento.", impact: "Alto", icon: "tag" },
  { title: "E-mail de progresso semanal", desc: "Resumo de evolução para reativar 320 usuários gratuitos.", impact: "Médio", icon: "mail" },
  { title: "Desafio comunitário", desc: "Criar desafio de 7 dias para aumentar frequência semanal.", impact: "Médio", icon: "trophy" },
];

export const fmtCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const fmtNumber = (n: number) => n.toLocaleString("pt-BR");

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function relativeDays(iso: string) {
  const now = new Date("2026-05-30T12:00:00Z").getTime();
  const d = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m === 1 ? "mês" : "meses"}`;
}
