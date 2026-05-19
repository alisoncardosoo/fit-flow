import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { focus, duration, equipment } = await req.json();
    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .maybeSingle();
    const AI_PROVIDER_API_KEY = keyRow?.api_key?.trim();
    if (!AI_PROVIDER_API_KEY) {
      return new Response(JSON.stringify({ error: "Insira sua chave de inteligência artificial nas configurações." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get available exercises
    const { data: exercises } = await supabase.from("exercises").select("id, name, muscle_group, equipment").eq("is_public", true);
    const exList = (exercises ?? []).map((e) => `${e.id}|${e.name}|${e.muscle_group}|${e.equipment}`).join("\n");

    const systemPrompt = `Você é um personal trainer. Selecione exercícios da biblioteca para montar um treino eficiente. Responda APENAS com JSON válido nesse formato exato:
{
  "name": "Nome curto do treino",
  "exercises": [
    {"id": "uuid-do-exercicio", "sets": 3, "reps": 10, "rest_seconds": 60}
  ]
}
Não inclua texto fora do JSON. Use apenas IDs da lista fornecida. Quantidade de exercícios proporcional à duração: ~6 para 30min, ~8 para 60min, ~10 para 90min.`;

    const userPrompt = `Foco: ${focus}\nDuração: ${duration} minutos\nEquipamento: ${equipment}\n\nBiblioteca (id|nome|grupo|equipamento):\n${exList}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(JSON.stringify({ error: status === 429 ? "Limite atingido" : status === 402 ? "Créditos esgotados" : "Erro IA" }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    const validIds = new Set((exercises ?? []).map((e) => e.id));
    const filtered = (parsed.exercises ?? []).filter((e: { id: string }) => validIds.has(e.id));
    if (!filtered.length) throw new Error("IA não retornou exercícios válidos");

    // Create workout
    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .insert({ user_id: user.id, name: parsed.name || `Treino — ${focus}`, description: `Gerado por IA · ${duration}min` })
      .select()
      .single();
    if (wErr || !workout) throw wErr ?? new Error("Erro criando treino");

    // Create default sheet "A" so exercises show up in the UI
    const { data: sheet, error: sErr } = await supabase
      .from("routine_sheets")
      .insert({ workout_id: workout.id, name: "A", position: 0 })
      .select()
      .single();
    if (sErr || !sheet) throw sErr ?? new Error("Erro criando ficha");

    const { error: insErr } = await supabase.from("workout_exercises").insert(
      filtered.map((e: { id: string; sets?: number; reps?: number; rest_seconds?: number }, i: number) => ({
        workout_id: workout.id,
        sheet_id: sheet.id,
        exercise_id: e.id,
        position: i,
        target_sets: e.sets ?? 3,
        target_reps: e.reps ?? 10,
        target_weight: 0,
        rest_seconds: e.rest_seconds ?? 60,
      })),
    );
    if (insErr) throw insErr;

    // Readback to confirm persistence before responding
    const { count } = await supabase
      .from("workout_exercises")
      .select("id", { count: "exact", head: true })
      .eq("workout_id", workout.id);

    return new Response(
      JSON.stringify({ workout_id: workout.id, sheet_id: sheet.id, exercises_count: count ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-workout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
