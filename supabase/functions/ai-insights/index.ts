// AI Insights edge function — analyzes user training data and returns
// personalized insights, recommendations and an evolution forecast.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

type ActionAdjustWeekly = { kind: "adjust_weekly_target"; weekly_target: number };
type ActionGenerateWorkout = {
  kind: "generate_workout";
  focus: string;
  duration_minutes: number;
  equipment: string;
};
type Action = ActionAdjustWeekly | ActionGenerateWorkout;

interface Recommendation {
  text: string;
  action: Action | null;
}

interface InsightsResponse {
  summary: string;
  insights: { icon: "trend" | "alert" | "tip" | "win"; title: string; body: string }[];
  recommendations: Recommendation[];
  forecast: { next_30_days_volume_pct: number; next_pr_exercise: string | null; rationale: string };
}

interface CachedInsightsResponse extends InsightsResponse {
  generated_at: string;
  cached: boolean;
}

const CACHE_TTL_HOURS = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .maybeSingle();
    const AI_PROVIDER_API_KEY = keyRow?.api_key?.trim();
    if (!AI_PROVIDER_API_KEY) {
      return new Response(JSON.stringify({ error: "Configure sua chave de API em Perfil > Configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body — supports { force: true } to bypass cache
    let force = false;
    try {
      const body = await req.json().catch(() => ({}));
      force = Boolean(body?.force);
    } catch {
      /* no body, ignore */
    }

    // ----- Cache lookup (TTL 12h) -----
    if (!force) {
      const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600_000).toISOString();
      const { data: cached } = await supabase
        .from("ai_insights")
        .select("payload, generated_at")
        .eq("user_id", userId)
        .gte("generated_at", cutoff)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached?.payload) {
        const resp: CachedInsightsResponse = {
          ...(cached.payload as InsightsResponse),
          generated_at: cached.generated_at,
          cached: true,
        };
        return new Response(JSON.stringify(resp), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ----- Gather training data (last 60 days) -----
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceISO = since.toISOString();

    const [{ data: sessions }, { data: sets }, { data: profile }] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("started_at, total_volume, duration_seconds, workout_name")
        .eq("user_id", userId)
        .not("finished_at", "is", null)
        .gte("started_at", sinceISO)
        .order("started_at"),
      supabase
        .from("set_logs")
        .select("weight, reps, completed_at, exercises(name, muscle_group)")
        .eq("user_id", userId)
        .gte("completed_at", sinceISO)
        .order("completed_at"),
      supabase
        .from("profiles")
        .select("weekly_target, goal, level, display_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const sessionsArr = sessions ?? [];
    const setsArr = (sets ?? []) as Array<{
      weight: number;
      reps: number;
      completed_at: string;
      exercises: { name: string; muscle_group: string } | null;
    }>;

    if (sessionsArr.length < 2) {
      const fallback: InsightsResponse = {
        summary: "Treine mais alguns dias para destravar análises personalizadas.",
        insights: [
          {
            icon: "tip",
            title: "Construa consistência",
            body: "Execute pelo menos 2 treinos para começarmos a identificar padrões.",
          },
        ],
        recommendations: [
          {
            text: "Gere seu primeiro treino com IA focado em corpo inteiro",
            action: { kind: "generate_workout", focus: "corpo inteiro", duration_minutes: 45, equipment: "qualquer" },
          },
          { text: "Defina uma meta semanal realista (3 treinos)", action: { kind: "adjust_weekly_target", weekly_target: 3 } },
          { text: "Comece com sessões de 30-45 minutos", action: null },
        ],
        forecast: { next_30_days_volume_pct: 0, next_pr_exercise: null, rationale: "Dados insuficientes." },
      };
      const resp: CachedInsightsResponse = {
        ...fallback,
        generated_at: new Date().toISOString(),
        cached: false,
      };
      return new Response(JSON.stringify(resp), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- Aggregate features -----
    const last7 = sessionsArr.filter(
      (s) => new Date(s.started_at).getTime() >= Date.now() - 7 * 86400000,
    );
    const last30 = sessionsArr.filter(
      (s) => new Date(s.started_at).getTime() >= Date.now() - 30 * 86400000,
    );
    const prev30 = sessionsArr.filter((s) => {
      const t = new Date(s.started_at).getTime();
      return t >= Date.now() - 60 * 86400000 && t < Date.now() - 30 * 86400000;
    });

    const sumVol = (arr: typeof sessionsArr) =>
      arr.reduce((a, s) => a + Number(s.total_volume ?? 0), 0);
    const avgDur = (arr: typeof sessionsArr) =>
      arr.length ? arr.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / arr.length / 60 : 0;

    // muscle distribution
    const muscleVolume = new Map<string, number>();
    for (const s of setsArr) {
      const mg = s.exercises?.muscle_group ?? "outro";
      muscleVolume.set(mg, (muscleVolume.get(mg) ?? 0) + s.weight * s.reps);
    }
    const muscleDist = [...muscleVolume.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ group: k, volume: Math.round(v) }));

    // top exercises by max weight (PR)
    const prMap = new Map<string, number>();
    for (const s of setsArr) {
      const name = s.exercises?.name ?? "?";
      prMap.set(name, Math.max(prMap.get(name) ?? 0, s.weight));
    }
    const topPRs = [...prMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, kg]) => ({ name, kg }));

    // weekday distribution
    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    for (const s of sessionsArr) dayCount[new Date(s.started_at).getDay()]++;

    const features = {
      profile: {
        name: profile?.display_name ?? null,
        goal: profile?.goal ?? null,
        level: profile?.level ?? null,
        weekly_target: profile?.weekly_target ?? 4,
      },
      totals: {
        sessions_60d: sessionsArr.length,
        sessions_last_7d: last7.length,
        sessions_last_30d: last30.length,
        sessions_prev_30d: prev30.length,
        volume_last_30d: Math.round(sumVol(last30)),
        volume_prev_30d: Math.round(sumVol(prev30)),
        avg_duration_min_30d: Math.round(avgDur(last30)),
      },
      muscle_distribution: muscleDist,
      top_prs: topPRs,
      weekday_sessions: {
        sun: dayCount[0],
        mon: dayCount[1],
        tue: dayCount[2],
        wed: dayCount[3],
        thu: dayCount[4],
        fri: dayCount[5],
        sat: dayCount[6],
      },
    };

    // ----- Call AI with structured tool output -----
    const systemPrompt = `Você é um coach de musculação e ciência do esporte de elite.
Recebe métricas reais do usuário (em pt-BR) e gera insights ACIONÁVEIS, específicos e numéricos.
NUNCA invente dados. Use apenas o que está nos números fornecidos.
Tom: motivador, direto, técnico mas humano. Sem jargão excessivo. Frases curtas.
Considere o objetivo (hypertrophy, strength, etc) ao priorizar recomendações.`;

    const userPrompt = `Dados do usuário (últimos 60 dias):
${JSON.stringify(features, null, 2)}

Gere:
1. summary: 1 frase impactante sobre o momento atual (máx 90 chars).
2. insights: 3-5 observações concretas (use números reais dos dados).
3. recommendations: EXATAMENTE 3 ações para os próximos 7 dias. Cada uma tem "text" (frase curta) e "action" (objeto ou null).
   - Pelo menos 1 recomendação DEVE ter action acionável.
   - "adjust_weekly_target": use quando a frequência atual diverge do ideal. weekly_target = número de treinos/semana sugerido (1-7), considerando atual=${features.profile.weekly_target} e sessions_last_7d=${features.totals.sessions_last_7d}.
   - "generate_workout": use quando faltar volume em algum grupo muscular ou pra balancear treino. focus = grupo muscular em pt-BR (ex: "peito e tríceps", "pernas", "costas"). duration_minutes entre 30 e 75. equipment: "qualquer", "halteres", "barra" ou "peso corporal".
   - action=null para conselhos gerais (descanso, nutrição, técnica).
4. forecast: previsão realista de evolução de volume nos próximos 30 dias (%) e qual exercício tem maior chance de novo PR (use exatamente um nome de top_prs).`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_PROVIDER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "render_insights",
              description: "Retorna análise estruturada do treino do usuário",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Frase de impacto, máx 90 chars" },
                  insights: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        icon: { type: "string", enum: ["trend", "alert", "tip", "win"] },
                        title: { type: "string", description: "Título curto, máx 40 chars" },
                        body: { type: "string", description: "Explicação numérica, máx 180 chars" },
                      },
                      required: ["icon", "title", "body"],
                      additionalProperties: false,
                    },
                  },
                  recommendations: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Ação específica, máx 120 chars" },
                        action: {
                          anyOf: [
                            {
                              type: "object",
                              properties: {
                                kind: { type: "string", enum: ["adjust_weekly_target"] },
                                weekly_target: { type: "integer", minimum: 1, maximum: 7 },
                              },
                              required: ["kind", "weekly_target"],
                              additionalProperties: false,
                            },
                            {
                              type: "object",
                              properties: {
                                kind: { type: "string", enum: ["generate_workout"] },
                                focus: { type: "string", description: "Grupo muscular foco em pt-BR" },
                                duration_minutes: { type: "integer", minimum: 20, maximum: 90 },
                                equipment: { type: "string" },
                              },
                              required: ["kind", "focus", "duration_minutes", "equipment"],
                              additionalProperties: false,
                            },
                            { type: "null" },
                          ],
                        },
                      },
                      required: ["text", "action"],
                      additionalProperties: false,
                    },
                  },
                  forecast: {
                    type: "object",
                    properties: {
                      next_30_days_volume_pct: { type: "number", description: "Variação % esperada" },
                      next_pr_exercise: { type: "string" },
                      rationale: { type: "string", description: "Justificativa, máx 160 chars" },
                    },
                    required: ["next_30_days_volume_pct", "next_pr_exercise", "rationale"],
                    additionalProperties: false,
                  },
                },
                required: ["summary", "insights", "recommendations", "forecast"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "render_insights" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de uso atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar insights" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments) as InsightsResponse;

    // Persist in cache (best-effort; don't fail the request if insert fails)
    const generatedAt = new Date().toISOString();
    const { error: cacheErr } = await supabase
      .from("ai_insights")
      .insert({ user_id: userId, payload: parsed });
    if (cacheErr) console.error("ai_insights cache insert failed", cacheErr);

    const resp: CachedInsightsResponse = { ...parsed, generated_at: generatedAt, cached: false };
    return new Response(JSON.stringify(resp), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
