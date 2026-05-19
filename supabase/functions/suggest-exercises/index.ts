import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

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

    const { muscle_group, available_names } = await req.json();
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

    const systemPrompt = `Você é um personal trainer experiente. Sugira 5 exercícios eficazes para o grupo muscular pedido. Responda APENAS com uma lista numerada, em português, sem explicações longas. Cada item: "Nome do exercício — breve dica (máx 12 palavras)".`;

    const userPrompt = `Grupo muscular: ${muscle_group}. Já temos na biblioteca: ${(available_names || []).slice(0, 30).join(", ")}. Sugira 5 exercícios complementares ou variações úteis.`;

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
      const status = response.status;
      const msg = status === 429 ? "Limite atingido. Tente em instantes." : status === 402 ? "Créditos esgotados." : "Erro IA";
      return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const suggestions = text.split("\n").map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 5);

    return new Response(JSON.stringify({ suggestions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
