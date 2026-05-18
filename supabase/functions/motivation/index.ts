import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { streak, weekCount, weeklyTarget, name } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um coach fitness motivador, direto e brasileiro. Gere UMA mensagem motivacional curta (máximo 18 palavras), em português, com 1-2 emojis no máximo. Tom: empolgado mas não exagerado. Não use aspas. Não comece com "Olá".`;

    const userPrompt = `Atleta: ${name || "usuário"}. Streak atual: ${streak} dias. Treinos esta semana: ${weekCount}/${weeklyTarget}. Gere a mensagem ideal.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
