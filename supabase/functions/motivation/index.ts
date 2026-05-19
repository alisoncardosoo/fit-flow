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

    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .maybeSingle();
    const AI_PROVIDER_API_KEY = keyRow?.api_key?.trim();
    if (!AI_PROVIDER_API_KEY) {
      return new Response(JSON.stringify({ error: "Insira sua chave de inteligência artificial nas configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { streak, weekCount, weeklyTarget, name } = await req.json();

    const systemPrompt = `Você é um coach fitness motivador, direto e brasileiro. Gere UMA mensagem motivacional curta (máximo 18 palavras), em português, com 1-2 emojis no máximo. Tom: empolgado mas não exagerado. Não use aspas. Não comece com "Olá".`;

    const userPrompt = `Atleta: ${name || "usuário"}. Streak atual: ${streak} dias. Treinos esta semana: ${weekCount}/${weeklyTarget}. Gere a mensagem ideal.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ message: getFallback(streak) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ message: getFallback(streak) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim() ?? getFallback(streak);

    return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("motivation error:", e);
    return new Response(JSON.stringify({ message: "Vamos lá! Cada treino conta 💪" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function getFallback(streak: number): string {
  if (streak === 0) return "Hora de voltar ao ritmo. Bora? 💪";
  if (streak < 3) return `${streak} ${streak === 1 ? "dia" : "dias"} consecutivos. Continue!`;
  if (streak < 7) return `🔥 ${streak} dias seguidos. Pegando ritmo!`;
  return `🔥 ${streak} dias consecutivos. Você é uma máquina!`;
}
