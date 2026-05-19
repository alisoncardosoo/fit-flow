import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type AIExercise = {
  name: string;
  muscle_group: string;
  equipment?: string;
  sets: number;
  reps: number;
  weight?: number;
  rest_seconds?: number;
  notes?: string;
};

type AIWorkout = {
  name: string;
  description?: string;
  exercises: AIExercise[];
};

type AIResponse = {
  workouts: AIWorkout[];
};

const VALID_MUSCLES = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core", "cardio", "full_body",
];
const VALID_EQUIP = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other"];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyMatch(name: string, candidates: { id: string; name: string }[]): string | null {
  const target = normalize(name);
  if (!target) return null;
  // exact normalized
  const exact = candidates.find((c) => normalize(c.name) === target);
  if (exact) return exact.id;
  // contains either way
  const partial = candidates.find((c) => {
    const n = normalize(c.name);
    return n.includes(target) || target.includes(n);
  });
  if (partial) return partial.id;
  // token overlap >= 60%
  const tokens = new Set(target.split(" ").filter((t) => t.length > 2));
  if (tokens.size === 0) return null;
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const cTokens = new Set(normalize(c.name).split(" ").filter((t) => t.length > 2));
    let hit = 0;
    tokens.forEach((t) => { if (cTokens.has(t)) hit++; });
    const score = hit / tokens.size;
    if (score >= 0.6 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Robust body parsing: req.json() can throw "Unexpected end of JSON input"
    // for large payloads or interrupted streams. Read raw text first.
    let bodyText = "";
    try {
      bodyText = await req.text();
    } catch (readErr) {
      console.error("body read error", readErr);
      return new Response(JSON.stringify({ error: "Falha ao ler imagem (tente uma imagem menor)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!bodyText || bodyText.length < 10) {
      return new Response(JSON.stringify({ error: "Corpo da requisição vazio. Tente novamente com uma imagem menor." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ~6MB hard cap on JSON body to avoid AI gateway timeouts
    if (bodyText.length > 6_500_000) {
      return new Response(JSON.stringify({ error: "Imagem muito grande. Tente uma foto menor ou mais comprimida." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let payload: { image_data_url?: string };
    try {
      payload = JSON.parse(bodyText);
    } catch (parseErr) {
      console.error("body parse error", parseErr, "len:", bodyText.length);
      return new Response(JSON.stringify({ error: "Imagem corrompida no envio. Tente novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const image_data_url = payload?.image_data_url;
    if (!image_data_url || typeof image_data_url !== "string" || !image_data_url.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "Imagem ausente ou inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const systemPrompt = `Você é um especialista em fitness que extrai treinos de imagens (fotos de planilhas, papéis, prints de outros apps, fotos de tabelas de personal trainer). 
Analise a imagem e identifique todas as fichas de treino. Se houver divisões A/B/C/D, retorne uma para cada. Se for uma ficha única, retorne uma só.

Use a ferramenta extract_workouts para retornar a estrutura. Para cada exercício:
- name: nome do exercício como aparece na imagem (em português)
- muscle_group: um destes ENUM exatos: chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core, cardio, full_body
- equipment: um destes ENUM exatos: barbell, dumbbell, machine, cable, bodyweight, kettlebell, band, other
- sets, reps: números (se intervalo "8-12", use o menor; se "3x10", sets=3 reps=10)
- weight: peso em kg se visível, senão omita
- rest_seconds: tempo de descanso em segundos se visível, senão 60
- notes: observações relevantes (cadência, técnica) se houver

Para o nome do treino: use o que aparece na imagem ("Treino A", "Push Day", etc.) ou crie um descritivo baseado nos músculos trabalhados.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todas as fichas de treino desta imagem." },
              { type: "image_url", image_url: { url: image_data_url } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_workouts",
              description: "Retorna as fichas de treino extraídas da imagem.",
              parameters: {
                type: "object",
                properties: {
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        exercises: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              muscle_group: { type: "string", enum: VALID_MUSCLES },
                              equipment: { type: "string", enum: VALID_EQUIP },
                              sets: { type: "number" },
                              reps: { type: "number" },
                              weight: { type: "number" },
                              rest_seconds: { type: "number" },
                              notes: { type: "string" },
                            },
                            required: ["name", "muscle_group", "sets", "reps"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["name", "exercises"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["workouts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_workouts" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      const errText = await aiResp.text();
      console.error("AI error", status, errText);
      const msg = status === 429 ? "Muitas requisições. Tente novamente em instantes."
        : status === 402 ? "Créditos da IA esgotados. Adicione créditos no workspace."
        : "Falha ao analisar imagem.";
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou estrutura válida");
    }
    const parsed: AIResponse = JSON.parse(toolCall.function.arguments);
    if (!parsed.workouts?.length) throw new Error("Nenhum treino identificado");

    // Load library: public + user's own
    const { data: libRaw } = await supabase
      .from("exercises")
      .select("id, name, muscle_group, user_id, is_public")
      .or(`is_public.eq.true,user_id.eq.${user.id}`);
    const library = (libRaw ?? []) as { id: string; name: string; muscle_group: string }[];

    let createdExercises = 0;
    const createdWorkouts: { id: string; name: string }[] = [];

    for (const wk of parsed.workouts) {
      // create workout
      const { data: w, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          name: wk.name?.trim() || "Treino importado",
          description: (wk.description?.trim() || "Importado de imagem").slice(0, 200),
        })
        .select()
        .single();
      if (wErr || !w) {
        console.error("workout insert error", wErr);
        continue;
      }

      // Create default sheet "A" so exercises render in the UI
      const { data: sheet, error: sErr } = await supabase
        .from("routine_sheets")
        .insert({ workout_id: w.id, name: "A", position: 0 })
        .select()
        .single();
      if (sErr || !sheet) {
        console.error("sheet insert error", sErr);
        continue;
      }

      const rows: Array<{
        workout_id: string; sheet_id: string; exercise_id: string; position: number;
        target_sets: number; target_reps: number; target_weight: number;
        rest_seconds: number; notes: string | null;
      }> = [];

      for (let i = 0; i < wk.exercises.length; i++) {
        const ex = wk.exercises[i];
        // 1) try fuzzy match in library
        let exerciseId = fuzzyMatch(ex.name, library.map((l) => ({ id: l.id, name: l.name })));

        // 2) create as user's private exercise if no match
        if (!exerciseId) {
          const muscle = VALID_MUSCLES.includes(ex.muscle_group) ? ex.muscle_group : "full_body";
          const equip = ex.equipment && VALID_EQUIP.includes(ex.equipment) ? ex.equipment : "other";
          const { data: newEx, error: eErr } = await supabase
            .from("exercises")
            .insert({
              user_id: user.id,
              name: ex.name.trim().slice(0, 80),
              muscle_group: muscle,
              equipment: equip,
              is_public: false,
            })
            .select("id, name, muscle_group")
            .single();
          if (eErr || !newEx) {
            console.error("exercise insert error", eErr, ex.name);
            continue;
          }
          exerciseId = newEx.id;
          library.push({ id: newEx.id, name: newEx.name, muscle_group: newEx.muscle_group });
          createdExercises++;
        }

        rows.push({
          workout_id: w.id,
          sheet_id: sheet.id,
          exercise_id: exerciseId,
          position: i,
          target_sets: Math.max(1, Math.min(20, Math.round(ex.sets))),
          target_reps: Math.max(1, Math.min(100, Math.round(ex.reps))),
          target_weight: ex.weight && ex.weight > 0 ? ex.weight : 0,
          rest_seconds: ex.rest_seconds && ex.rest_seconds > 0 ? Math.min(600, ex.rest_seconds) : 60,
          notes: ex.notes?.trim() || null,
        });
      }

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("workout_exercises").insert(rows);
        if (insErr) {
          console.error("workout_exercises insert error", insErr);
          continue;
        }
        // Readback to confirm rows are visible before responding
        const { count } = await supabase
          .from("workout_exercises")
          .select("id", { count: "exact", head: true })
          .eq("workout_id", w.id);
        if ((count ?? 0) === 0) {
          console.error("workout_exercises readback empty", w.id);
        }
      }
      createdWorkouts.push({ id: w.id, name: w.name });
    }

    if (!createdWorkouts.length) throw new Error("Nenhum treino criado");

    return new Response(
      JSON.stringify({
        workouts: createdWorkouts,
        created_exercises: createdExercises,
        primary_workout_id: createdWorkouts[0].id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("import-workout-from-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
