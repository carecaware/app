// Edge Function: validate-license
// Corpo: { license_key, platform, device_id, legacy_device_id?, action? }
//   action = "validate" (padrão) | "release" (libera aparelhos antigos e ativa este)
// Resposta válida: { valid: true, tier: "basic"|"premium", trial, expires_at, premium_since, downgrade_at, unlock_until? }
// Resposta inválida: { valid: false, reason, can_release? }
//   reason: bad_request | not_found | revoked | expired | wrong_platform | limit_reached
//           | release_limit | server_error (temporário!)
//
// Implantação: supabase functions deploy validate-license --no-verify-jwt
// (rode antes os arquivos migration-002 a migration-006 no SQL Editor)

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
      .select("id, platform, max_activations, revoked, max_releases_per_year, pw_unlock_until, tier, trial_days, expires_at, downgrade_at")
      .eq("license_key", String(license_key).trim().toUpperCase())
      .maybeSingle();
    if (error) return json({ valid: false, reason: "server_error" });
    if (!license) return json({ valid: false, reason: "not_found" });
    if (license.revoked) return json({ valid: false, reason: "revoked" });
    if (license.platform !== platform) return json({ valid: false, reason: "wrong_platform" });
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) return json({ valid: false, reason: "expired" });

    const now = new Date().toISOString();
    const { data: acts, error: e2 } = await supabase
      .from("license_activations").select("id, device_id, activated_at").eq("license_id", license.id);
    if (e2) return json({ valid: false, reason: "server_error" });
    const list = acts || [];

    // estado da assinatura devolvido ao app (tipo, teste, datas)
    const okRes = async (extra: Record<string, unknown> = {}) => {
      const nowMs = Date.now();
      const isTrial = !!license.trial_days;
      // teste: a validade começa na PRIMEIRA ativação
      let expiresAt = license.expires_at ? new Date(license.expires_at).getTime() : 0;
      if (isTrial && !expiresAt) {
        expiresAt = nowMs + license.trial_days * 86400000;
        await supabase.from("licenses").update({ expires_at: new Date(expiresAt).toISOString() }).eq("id", license.id);
      }
      // chave premium usada por esta licença (ver migration-005.sql)
      const { data: prem } = await supabase.from("premium_keys").select("redeemed_at")
        .eq("license_id", license.id).eq("revoked", false).limit(1);
      const premKey = prem && prem.length ? prem[0] : null;
      let tier = (license.tier === "premium" || premKey) ? "premium" : "basic";
      const down = license.downgrade_at ? new Date(license.downgrade_at).getTime() : 0;
      if (!isTrial && tier === "premium" && down && down <= nowMs) tier = "basic";
      // início do premium (define o dia do mês da cobrança)
      let since = nowMs;
      if (license.tier === "premium") {
        const first = list.map((a) => new Date(a.activated_at).getTime()).filter((n) => n > 0).sort((a, b) => a - b)[0];
        since = first || nowMs;
      } else if (premKey && premKey.redeemed_at) since = new Date(premKey.redeemed_at).getTime();
      const unlockMs = license.pw_unlock_until ? new Date(license.pw_unlock_until).getTime() : 0;
      return json({
        valid: true, tier, trial: isTrial, expires_at: expiresAt || null, premium_since: since, downgrade_at: down || null,
        ...(unlockMs > nowMs ? { unlock_until: unlockMs } : {}), ...extra,
      });
    };

    // 1) aparelho já ativado
    const mine = list.find((a) => a.device_id === device_id);
    if (mine) {
      await supabase.from("license_activations").update({ last_seen_at: now, platform }).eq("id", mine.id);
      return await okRes();
    }

    // 2) migração do ID antigo (aleatório) para o ID estável: troca, sem gastar vaga
    if (legacy) {
      const old = list.find((a) => a.device_id === legacy);
      if (old) {
        await supabase.from("license_activations")
          .update({ device_id, last_seen_at: now, platform }).eq("id", old.id);
        return await okRes();
      }
    }

    // 3) vaga livre
    if (list.length < license.max_activations) {
      await supabase.from("license_activations")
        .insert({ license_id: license.id, device_id, last_seen_at: now, platform });
      return await okRes();
    }

    // 4) sem vaga: só libera se o cliente pediu e ainda tem trocas no ano
    const sinceYear = new Date(Date.now() - 365 * 86400000).toISOString();
    const { count } = await supabase.from("license_releases")
      .select("id", { count: "exact", head: true })
      .eq("license_id", license.id).gte("released_at", sinceYear);
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
    return await okRes({ released: true });
  } catch (_e) {
    return json({ valid: false, reason: "server_error" });
  }
});

function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
