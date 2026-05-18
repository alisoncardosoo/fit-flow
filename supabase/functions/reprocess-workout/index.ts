import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const workoutId = (body as { workout_id?: string }).workout_id;
    if (!workoutId || typeof workoutId !== "string") {
      return new Response(JSON.stringify({ error: "workout_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load workout (RLS garante que é do usuário)
    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .select("id, name, description, user_id")
      .eq("id", workoutId)
      .maybeSingle();
    if (wErr || !workout) {
      return new Response(JSON.stringify({ error: "Treino não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Garantir sheet "A"
    const { data: sheets } = await supabase
      .from("routine_sheets")
      .select("id, position")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true });
    let defaultSheetId = sheets?.[0]?.id;
    if (!defaultSheetId) {
      const { data: ns, error: sErr } = await supabase
        .from("routine_sheets")
        .insert({ workout_id: workoutId, name: "A", position: 0 })
        .select("id")
        .single();
      if (sErr || !ns) throw sErr ?? new Error("Erro criando ficha");
      defaultSheetId = ns.id;
    }

    // 2) Vincular exercícios órfãos
    const { data: orphans } = await supabase
      .from("workout_exercises")
      .select("id")
      .eq("workout_id", workoutId)
      .is("sheet_id", null);
    let linked = 0;
    if (orphans && orphans.length > 0) {
      const { error: uErr } = await supabase
        .from("workout_exercises")
        .update({ sheet_id: defaultSheetId })
        .eq("workout_id", workoutId)
        .is("sheet_id", null);
      if (uErr) throw uErr;
      linked = orphans.length;
    }

    // 3) Verificar se treino tem exercícios; se vazio, regenerar via IA
    const { count: exCount } = await supabase
      .from("workout_exercises")
      .select("id", { count: "exact", head: true })
      .eq("workout_id", workoutId);

    let generated = 0;
    if ((exCount ?? 0) === 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "IA indisponível para regenerar" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: exercises } = await supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment")
        .eq("is_public", true);
      const exList = (exercises ?? [])
        .map((e) => `${e.id}|${e.name}|${e.muscle_group}|${e.equipment}`)
        .join("\n");

      const focus = (workout.description || workout.name || "treino completo").slice(0, 200);

      const systemPrompt = `Você é um personal trainer. Selecione exercícios da biblioteca para reconstruir um treino com base no nome e descrição fornecidos. Responda APENAS com JSON válido nesse formato exato:
{
  "exercises": [
    {"id": "uuid-do-exercicio", "sets": 3, "reps": 10, "rest_seconds": 60}
  ]
}
Não inclua texto fora do JSON. Use apenas IDs da lista fornecida. Inclua entre 6 e 8 exercícios variados e coerentes com o foco.`;

      const userPrompt = `Nome do treino: ${workout.name}\nFoco/descrição: ${focus}\n\nBiblioteca (id|nome|grupo|equipamento):\n${exList}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        return new Response(
          JSON.stringify({
            error: status === 429 ? "Limite atingido" : status === 402 ? "Créditos esgotados" : "Erro IA",
          }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const aiData = await aiResp.json();
      const text: string = aiData?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as {
        exercises?: { id: string; sets?: number; reps?: number; rest_seconds?: number }[];
      };
      const validIds = new Set((exercises ?? []).map((e) => e.id));
      const filtered = (parsed.exercises ?? []).filter((e) => validIds.has(e.id));
      if (!filtered.length) throw new Error("IA não retornou exercícios válidos");

      const { error: insErr } = await supabase.from("workout_exercises").insert(
        filtered.map((e, i) => ({
          workout_id: workoutId,
          sheet_id: defaultSheetId,
          exercise_id: e.id,
          position: i,
          target_sets: e.sets ?? 3,
          target_reps: e.reps ?? 10,
          target_weight: 0,
          rest_seconds: e.rest_seconds ?? 60,
        })),
      );
      if (insErr) throw insErr;
      generated = filtered.length;
    }

    // Bump updated_at
    await supabase.from("workouts").update({ updated_at: new Date().toISOString() }).eq("id", workoutId);

    return new Response(
      JSON.stringify({
        workout_id: workoutId,
        sheet_id: defaultSheetId,
        linked_exercises: linked,
        generated_exercises: generated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("reprocess-workout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
