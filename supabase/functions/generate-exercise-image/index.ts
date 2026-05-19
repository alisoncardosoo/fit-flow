import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MUSCLE_PT: Record<string, string> = {
  chest: "peito", back: "costas", shoulders: "ombros", biceps: "bíceps",
  triceps: "tríceps", forearms: "antebraços", quads: "quadríceps",
  hamstrings: "posterior de coxa", glutes: "glúteos", calves: "panturrilhas",
  core: "core", cardio: "cardio", full_body: "corpo inteiro",
};

const EQUIP_PT: Record<string, string> = {
  barbell: "barra olímpica", dumbbell: "halteres", machine: "máquina",
  cable: "polia/cabo", bodyweight: "peso corporal", kettlebell: "kettlebell",
  band: "elástico", other: "equipamento de academia",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- AuthN: require a valid JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { exercise_id, force } = await req.json();
    if (!exercise_id || typeof exercise_id !== "string") {
      return new Response(JSON.stringify({ error: "exercise_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- AuthZ: público OU dono pode gerar imagem.
    // Para exercícios que não são do usuário, a imagem é salva como override pessoal.
    const { data: ex, error: exErr } = await supabase
      .from("exercises")
      .select("id, name, muscle_group, equipment, image_url, user_id, is_public")
      .eq("id", exercise_id)
      .maybeSingle();
    if (exErr || !ex) {
      return new Response(JSON.stringify({ error: "exercício não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ex.user_id !== userId && !ex.is_public) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOwner = ex.user_id === userId;

    // Cache: se for dono, considera image_url do exercício; senão, considera override
    if (!force) {
      if (isOwner && ex.image_url) {
        return new Response(JSON.stringify({ image_url: ex.image_url, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!isOwner) {
        const { data: existingOverride } = await supabase
          .from("exercise_image_overrides")
          .select("image_url")
          .eq("user_id", userId)
          .eq("exercise_id", exercise_id)
          .maybeSingle();
        if (existingOverride?.image_url) {
          return new Response(JSON.stringify({ image_url: existingOverride.image_url, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: keyRow } = await authClient
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .maybeSingle();
    const apiKey = keyRow?.api_key?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Insira sua chave de inteligência artificial nas configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const muscle = MUSCLE_PT[ex.muscle_group] ?? ex.muscle_group;
    const equip = EQUIP_PT[ex.equipment] ?? ex.equipment;
    const prompt = `Ilustração 3D minimalista, estilo render limpo, de uma pessoa atlética executando o exercício "${ex.name}" focando em ${muscle} usando ${equip}. Fundo escuro liso (cinza-grafite #1a1a1a). Iluminação dramática com luz de destaque verde-lima (#CBFF9A). Pose técnica correta, em movimento. Sem texto, sem marcas d'água, sem logos. Composição centralizada, formato quadrado. Estética premium tipo app fitness moderno.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429)
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (aiResp.status === 402)
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      throw new Error("Falha ao gerar imagem");
    }

    const aiData = await aiResp.json();
    const dataUrl: string | undefined = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:image/")) throw new Error("Resposta sem imagem");

    const [, base64] = dataUrl.split(",");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Owner -> grava em pasta global; Override -> grava em pasta do usuário
    const path = isOwner
      ? `${ex.id}-${Date.now()}.png`
      : `${userId}/${ex.id}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("exercise-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("exercise-images").getPublicUrl(path);
    const image_url = pub.publicUrl;

    if (isOwner) {
      await supabase.from("exercises").update({ image_url }).eq("id", ex.id);
    } else {
      await supabase
        .from("exercise_image_overrides")
        .upsert(
          { user_id: userId, exercise_id: ex.id, image_url, source: "ai" },
          { onConflict: "user_id,exercise_id" },
        );
    }

    return new Response(JSON.stringify({ image_url, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exercise-image error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
