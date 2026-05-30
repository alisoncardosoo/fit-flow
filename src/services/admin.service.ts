import { supabase } from "@/integrations/supabase/client";

// ===========================================
// Camada de dados do painel administrativo — 100% Supabase.
// Cada função mapeia para uma RPC SECURITY DEFINER ou consulta com RLS de
// staff/admin. Os tipos de retorno são amigáveis para as telas.
// ===========================================

// ---- Dashboard -------------------------------------
export interface AdminKpis {
  totalUsers: number;
  activeUsers: number;
  newToday: number;
  activeSubscribers: number;
  mrrCents: number;
  arrCents: number;
}

export async function fetchAdminKpis(): Promise<AdminKpis> {
  const { data, error } = await supabase.rpc("admin_dashboard_kpis");
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number>;
  return {
    totalUsers: d.total_users ?? 0,
    activeUsers: d.active_users ?? 0,
    newToday: d.new_today ?? 0,
    activeSubscribers: d.active_subscribers ?? 0,
    mrrCents: d.mrr_cents ?? 0,
    arrCents: d.arr_cents ?? 0,
  };
}

export interface UserGrowthPoint {
  day: string;
  novos: number;
  total: number;
}

export async function fetchUserGrowth(days = 30): Promise<UserGrowthPoint[]> {
  const { data, error } = await supabase.rpc("admin_user_growth", { _days: days });
  if (error) throw error;
  return (data ?? []).map((r) => ({ day: r.day, novos: Number(r.novos), total: Number(r.total) }));
}

export interface RevenuePoint {
  month: string;
  revenueCents: number;
}

export async function fetchRevenueMonthly(months = 12): Promise<RevenuePoint[]> {
  const { data, error } = await supabase.rpc("admin_revenue_monthly", { _months: months });
  if (error) throw error;
  return (data ?? []).map((r) => ({ month: r.month, revenueCents: Number(r.revenue_cents) }));
}

export interface PlanDistribution {
  code: string;
  name: string;
  total: number;
}

export async function fetchPlanDistribution(): Promise<PlanDistribution[]> {
  const { data, error } = await supabase.rpc("admin_plan_distribution");
  if (error) throw error;
  return (data ?? []).map((r) => ({ code: r.plan_code, name: r.plan_name, total: Number(r.total) }));
}

export interface HeatCell {
  dow: number;
  hour: number;
  sessions: number;
}

export async function fetchEngagementHeatmap(days = 90): Promise<HeatCell[]> {
  const { data, error } = await supabase.rpc("admin_engagement_heatmap", { _days: days });
  if (error) throw error;
  return (data ?? []).map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), sessions: Number(r.sessions) }));
}

// ---- Usuários --------------------------------------
export interface AdminUserRow {
  userId: string;
  email: string;
  displayName: string | null;
  username: string | null;
  goal: string | null;
  planCode: string;
  subscriptionStatus: string;
  createdAt: string;
  lastSeen: string;
  totalSessions: number;
  streak: number;
}

export async function fetchAdminUsers(
  search?: string,
  limit = 50,
  offset = 0,
): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    _search: search?.trim() ? search.trim() : undefined,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    username: r.username,
    goal: r.goal,
    planCode: r.plan_code,
    subscriptionStatus: r.subscription_status,
    createdAt: r.created_at,
    lastSeen: r.last_seen,
    totalSessions: Number(r.total_sessions),
    streak: Number(r.streak),
  }));
}

// ---- Retenção --------------------------------------
export interface AtRiskCounts {
  d3: number;
  d7: number;
  d15: number;
  d30: number;
}

export async function fetchAtRiskCounts(): Promise<AtRiskCounts> {
  const { data, error } = await supabase.rpc("admin_at_risk_counts");
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number>;
  return { d3: d.d3 ?? 0, d7: d.d7 ?? 0, d15: d.d15 ?? 0, d30: d.d30 ?? 0 };
}

export interface StreakBuckets {
  s7: number;
  s15: number;
  s30: number;
  s90: number;
}

export async function fetchStreakBuckets(): Promise<StreakBuckets> {
  const { data, error } = await supabase.rpc("admin_streak_buckets");
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number>;
  return { s7: d.s7 ?? 0, s15: d.s15 ?? 0, s30: d.s30 ?? 0, s90: d.s90 ?? 0 };
}

// ---- Analytics -------------------------------------
export interface WorkoutAnalytics {
  started: number;
  finished: number;
  avgMinutes: number;
}

export async function fetchWorkoutAnalytics(): Promise<WorkoutAnalytics> {
  const { data, error } = await supabase.rpc("admin_workout_analytics");
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number>;
  return { started: d.started ?? 0, finished: d.finished ?? 0, avgMinutes: d.avg_minutes ?? 0 };
}

export interface ExerciseUsage {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  uses: number;
}

export async function fetchExerciseUsage(asc = false, limit = 5): Promise<ExerciseUsage[]> {
  const { data, error } = await supabase.rpc("admin_exercise_usage", { _asc: asc, _limit: limit });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    exerciseId: r.exercise_id,
    name: r.name,
    muscleGroup: r.muscle_group,
    uses: Number(r.uses),
  }));
}

// ---- Treinos ---------------------------------------
export interface WorkoutMetric {
  workoutId: string;
  name: string;
  archived: boolean;
  updatedAt: string;
  athletes: number;
  completions: number;
}

export async function fetchWorkoutMetrics(): Promise<WorkoutMetric[]> {
  const { data, error } = await supabase.rpc("admin_workout_metrics");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    workoutId: r.workout_id,
    name: r.name,
    archived: r.archived,
    updatedAt: r.updated_at,
    athletes: Number(r.athletes),
    completions: Number(r.completions),
  }));
}

// ---- Exercícios (tabela direta) --------------------
export interface AdminExerciseRow {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  difficulty: string;
  imageUrl: string | null;
}

export async function fetchAdminExercises(): Promise<AdminExerciseRow[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, equipment, difficulty, image_url")
    .eq("is_public", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    equipment: e.equipment,
    difficulty: e.difficulty,
    imageUrl: e.image_url,
  }));
}

// ---- Assinaturas -----------------------------------
export interface SubscriptionRow {
  id: string;
  userId: string;
  planId: string | null;
  status: string;
  gateway: string;
  amountCents: number;
  createdAt: string;
}

export async function fetchSubscriptions(): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id, status, gateway, amount_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    userId: s.user_id,
    planId: s.plan_id,
    status: s.status,
    gateway: s.gateway,
    amountCents: s.amount_cents,
    createdAt: s.created_at,
  }));
}

export interface SubscriptionEventRow {
  id: string;
  eventType: string;
  amountCents: number;
  gateway: string;
  createdAt: string;
}

export async function fetchSubscriptionEvents(): Promise<SubscriptionEventRow[]> {
  const { data, error } = await supabase
    .from("subscription_events")
    .select("id, event_type, amount_cents, gateway, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    amountCents: e.amount_cents,
    gateway: e.gateway,
    createdAt: e.created_at,
  }));
}

// ---- Cupons ----------------------------------------
export interface CouponRow {
  id: string;
  code: string;
  type: "percent" | "fixed" | "trial";
  value: number;
  planCode: string | null;
  maxUses: number;
  uses: number;
  active: boolean;
  expiresAt: string | null;
}

export async function fetchCoupons(): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select("id, code, type, value, plan_code, max_uses, uses, active, expires_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    planCode: c.plan_code,
    maxUses: c.max_uses,
    uses: c.uses,
    active: c.active,
    expiresAt: c.expires_at,
  }));
}

export interface CouponInput {
  code: string;
  type: "percent" | "fixed" | "trial";
  value: number;
  planCode?: string | null;
  maxUses?: number;
  expiresAt?: string | null;
}

export async function createCoupon(input: CouponInput): Promise<void> {
  const { error } = await supabase.from("coupons").insert({
    code: input.code.trim().toUpperCase(),
    type: input.type,
    value: input.value,
    plan_code: input.planCode ?? null,
    max_uses: input.maxUses ?? 0,
    expires_at: input.expiresAt ?? null,
  });
  if (error) throw error;
}

export async function toggleCoupon(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
  if (error) throw error;
}

// ---- Suporte ---------------------------------------
export interface TicketRow {
  id: string;
  userId: string | null;
  subject: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "medium" | "high" | "critical";
  channel: "email" | "chat" | "app";
  createdAt: string;
}

export async function fetchTickets(): Promise<TicketRow[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, subject, status, priority, channel, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    userId: t.user_id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    channel: t.channel,
    createdAt: t.created_at,
  }));
}

export async function updateTicketStatus(
  id: string,
  status: "open" | "pending" | "resolved",
): Promise<void> {
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---- Notificações (campanhas) ----------------------
export interface CampaignRow {
  id: string;
  title: string;
  audience: string;
  channel: string;
  reach: number;
  opened: number;
  sentAt: string | null;
}

export async function fetchCampaigns(): Promise<CampaignRow[]> {
  const { data, error } = await supabase
    .from("notification_campaigns")
    .select("id, title, audience, channel, reach, opened, sent_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    audience: c.audience,
    channel: c.channel,
    reach: c.reach,
    opened: c.opened,
    sentAt: c.sent_at,
  }));
}

export interface CampaignInput {
  title: string;
  body: string;
  channel: "push" | "email" | "in_app";
  audience: string;
  scheduledAt?: string | null;
}

export async function createCampaign(input: CampaignInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("notification_campaigns").insert({
    title: input.title.trim(),
    body: input.body,
    channel: input.channel,
    audience: input.audience,
    status: input.scheduledAt ? "scheduled" : "sent",
    scheduled_at: input.scheduledAt ?? null,
    sent_at: input.scheduledAt ? null : new Date().toISOString(),
    created_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}

// ---- Configurações ---------------------------------
export async function fetchSetting<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
    updated_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}
