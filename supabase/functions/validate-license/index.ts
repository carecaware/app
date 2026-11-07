// Edge Function: validate-license
// Corpo: { license_key, platform, device_id, legacy_device_id?, action? }
//   action = "validate" (padrão) | "release" (libera aparelhos antigos e ativa este)
// Resposta: { valid: true } ou { valid: false, reason, can_release? }
//   reason: bad_request | not_found | revoked | wrong_platform | limit_reached
//           | release_limit | server_error (temporário!)
//
// Implantação: supabase functions deploy validate-license --no-verify-jwt
// (rode antes o arquivo migration-002.sql no SQL Editor)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const license_key = body.license_key, platform = body.platform, device_id = body.device_id;
    const legacy = body.legacy_device_id, action = body.action || "validate";
    if (!license_key || !platform || !device_id) return json({ valid: false, reason: "bad_request" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: license, error } = await supabase
      .from("licenses")
      .select("id, platform, max_activations, revoked, max_releases_per_year")
      .eq("license_key", String(license_key).trim().toUpperCase())
      .maybeSingle();
    if (error) return json({ valid: false, reason: "server_error" });
    if (!license) return json({ valid: false, reason: "not_found" });
    if (license.revoked) return json({ valid: false, reason: "revoked" });
    if (license.platform !== platform) return json({ valid: false, reason: "wrong_platform" });

    const now = new Date().toISOString();
    const { data: acts, error: e2 } = await supabase
      .from("license_activations").select("id, device_id").eq("license_id", license.id);
    if (e2) return json({ valid: false, reason: "server_error" });
    const list = acts || [];

    // 1) aparelho já ativado
    const mine = list.find((a) => a.device_id === device_id);
    if (mine) {
      await supabase.from("license_activations").update({ last_seen_at: now, platform }).eq("id", mine.id);
      return json({ valid: true });
    }

    // 2) migração do ID antigo (aleatório) para o ID estável: troca, sem gastar vaga
    if (legacy) {
      const old = list.find((a) => a.device_id === legacy);
      if (old) {
        await supabase.from("license_activations")
          .update({ device_id, last_seen_at: now, platform }).eq("id", old.id);
        return json({ valid: true });
      }
    }

    // 3) vaga livre
    if (list.length < license.max_activations) {
      await supabase.from("license_activations")
        .insert({ license_id: license.id, device_id, last_seen_at: now, platform });
      return json({ valid: true });
    }

    // 4) sem vaga: só libera se o cliente pediu e ainda tem trocas no ano
    const since = new Date(Date.now() - 365 * 86400000).toISOString();
    const { count } = await supabase.from("license_releases")
      .select("id", { count: "exact", head: true })
      .eq("license_id", license.id).gte("released_at", since);
    const left = Math.max(0, (license.max_releases_per_year ?? 3) - (count ?? 0));

    if (action !== "release") return json({ valid: false, reason: "limit_reached", can_release: left > 0 });
    if (left <= 0) return json({ valid: false, reason: "release_limit", can_release: false });

    // libera as vagas ocupadas (guarda quem era) e ativa este aparelho
    for (const a of list) {
      await supabase.from("license_releases").insert({ license_id: license.id, device_id: a.device_id });
    }
    await supabase.from("license_activations").delete().eq("license_id", license.id);
    await supabase.from("license_activations")
      .insert({ license_id: license.id, device_id, last_seen_at: now, platform });
    return json({ valid: true, released: true });
  } catch (_e) {
    return json({ valid: false, reason: "server_error" });
  }
});

function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
