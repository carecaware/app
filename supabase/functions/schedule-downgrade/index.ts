// Edge Function: schedule-downgrade
// O cliente premium pede para voltar à versão básica: ele usa o premium até a DATA DE FATURAMENTO
// (o dia do mês em que o premium começou) e depois o app volta para a versão básica.
// Corpo: { license_key, device_id }
// Resposta: { ok: true, downgrade_at (ms), last_day (ms) } ou { ok: false, reason }
//   reason: bad_request | no_license | device_not_activated | not_premium | trial | server_error
//
// Implantação: supabase functions deploy schedule-downgrade --no-verify-jwt
// (rode antes a migration-006.sql)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: Record<string, unknown>) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

const TZ_OFFSET_MS = -3 * 3600000; // horário de Brasília

// próximo dia de faturamento (dia `day` do mês, ajustado ao tamanho do mês), contado em Brasília.
// Devolve o INÍCIO desse dia (UTC em ms).
function nextBillingDayStart(day: number, nowMs: number): number {
  const local = new Date(nowMs + TZ_OFFSET_MS);
  let y = local.getUTCFullYear(), m = local.getUTCMonth();
  for (let i = 0; i < 3; i++) {
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const start = Date.UTC(y, m, Math.min(day, dim)) - TZ_OFFSET_MS;
    if (start > nowMs) return start; // próximo dia de faturamento (a partir de amanhã)
    m++; if (m > 11) { m = 0; y++; }
  }
  return nowMs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const lk = String(body.license_key || "").trim().toUpperCase(), dev = String(body.device_id || "");
    if (!lk || !dev) return json({ ok: false, reason: "bad_request" });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: lic, error: e1 } = await sb.from("licenses").select("id, revoked, tier, trial_days").eq("license_key", lk).maybeSingle();
    if (e1) return json({ ok: false, reason: "server_error" });
    if (!lic || lic.revoked) return json({ ok: false, reason: "no_license" });
    if (lic.trial_days) return json({ ok: false, reason: "trial" });

    const { data: acts, error: e2 } = await sb.from("license_activations").select("device_id, activated_at").eq("license_id", lic.id);
    if (e2) return json({ ok: false, reason: "server_error" });
    if (!(acts || []).some((a) => a.device_id === dev)) return json({ ok: false, reason: "device_not_activated" });

    const { data: prem } = await sb.from("premium_keys").select("redeemed_at").eq("license_id", lic.id).eq("revoked", false).limit(1);
    const premKey = prem && prem.length ? prem[0] : null;
    if (lic.tier !== "premium" && !premKey) return json({ ok: false, reason: "not_premium" });

    // quando o premium começou: ativação da licença premium ou uso da chave premium
    let since = Date.now();
    if (lic.tier === "premium") {
      const first = (acts || []).map((a) => new Date(a.activated_at).getTime()).filter((n) => n > 0).sort((a, b) => a - b)[0];
      if (first) since = first;
    } else if (premKey && premKey.redeemed_at) since = new Date(premKey.redeemed_at).getTime();

    const day = new Date(since + TZ_OFFSET_MS).getUTCDate();
    const billing = nextBillingDayStart(day, Date.now());
    const downgradeAt = billing; // o premium vale até a data de faturamento; nela o app volta para a básica
    const { error: e3 } = await sb.from("licenses").update({ downgrade_at: new Date(downgradeAt).toISOString() }).eq("id", lic.id);
    if (e3) return json({ ok: false, reason: "server_error" });
    return json({ ok: true, downgrade_at: downgradeAt, last_day: billing });
  } catch (_e) {
    return json({ ok: false, reason: "server_error" });
  }
});
