import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type MapRow = {
  exercise_name_pt: string;
  slug: string;
};

const PUBLIC_IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get("SYNC_CATALOG_SECRET");
    if (!expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Missing SYNC_CATALOG_SECRET" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const providedSecret = req.headers.get("x-sync-secret");
    if (providedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: mapRows, error: mapError } = await admin
      .from("exercise_image_map")
      .select("exercise_name_pt, slug");

    if (mapError) throw mapError;

    const source = (mapRows ?? []).filter(
      (r): r is MapRow => !!r.exercise_name_pt?.trim() && !!r.slug?.trim(),
    );

    if (source.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, updated: 0, total_mapped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedByName = new Map<string, MapRow>();
    for (const row of source) {
      const key = row.exercise_name_pt.trim().toLowerCase();
      if (!normalizedByName.has(key)) normalizedByName.set(key, row);
    }

    const { data: existing, error: existingError } = await admin
      .from("exercises")
      .select("id, name, image_url, is_public");
    if (existingError) throw existingError;

    const existingByName = new Map(
      (existing ?? []).map((ex) => [ex.name.trim().toLowerCase(), ex]),
    );

    const toInsert = Array.from(normalizedByName.values())
      .filter((row) => !existingByName.has(row.exercise_name_pt.trim().toLowerCase()))
      .map((row) => ({
        name: row.exercise_name_pt.trim(),
        muscle_group: "full_body" as const,
        equipment: "other" as const,
        difficulty: "intermediate" as const,
        is_public: true,
        user_id: null,
        description: "Exercício do catálogo público FitFlow",
        image_url: `${PUBLIC_IMAGE_BASE}/${row.slug}/0.jpg`,
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insertError, data: insertedRows } = await admin
        .from("exercises")
        .insert(toInsert)
        .select("id");
      if (insertError) throw insertError;
      inserted = insertedRows?.length ?? toInsert.length;
    }

    let updated = 0;
    for (const row of source) {
      const key = row.exercise_name_pt.trim().toLowerCase();
      const ex = existingByName.get(key);
      if (!ex || !ex.is_public) continue;
      const mappedUrl = `${PUBLIC_IMAGE_BASE}/${row.slug}/0.jpg`;
      const shouldUpdate = !ex.image_url || ex.image_url.includes("supabase.co/storage");
      if (!shouldUpdate) continue;
      const { error: updateError } = await admin
        .from("exercises")
        .update({ image_url: mappedUrl })
        .eq("id", ex.id);
      if (updateError) throw updateError;
      updated += 1;
    }

    return new Response(
      JSON.stringify({
        inserted,
        updated,
        total_mapped: source.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
