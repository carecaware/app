// Edge Function: redeem-premium
// Corpo: { premium_key, license_key, device_id }
// Resposta: { valid: true } ou { valid: false, reason }
//   reason: bad_request | no_license | device_not_activated | not_found | revoked
//           | already_used | server_error (temporário!)
//
// Implantação: supabase functions deploy redeem-premium --no-verify-jwt
// (rode antes o arquivo migration-005.sql no SQL Editor)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: Record<string, unknown>) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const pk = String(body.premium_key || "").trim().toUpperCase();
    const lk = String(body.license_key || "").trim().toUpperCase();
    const dev = String(body.device_id || "");
    if (!pk || !lk || !dev) return json({ valid: false, reason: "bad_request" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: lic, error: e1 } = await sb.from("licenses").select("id, revoked").eq("license_key", lk).maybeSingle();
    if (e1) return json({ valid: false, reason: "server_error" });
    if (!lic || lic.revoked) return json({ valid: false, reason: "no_license" });

    // o pedido precisa vir de um aparelho já ativado nesta licença
    const { data: act, error: e2 } = await sb.from("license_activations").select("id").eq("license_id", lic.id).eq("device_id", dev).maybeSingle();
    if (e2) return json({ valid: false, reason: "server_error" });
    if (!act) return json({ valid: false, reason: "device_not_activated" });

    const { data: row, error: e3 } = await sb.from("premium_keys").select("id, license_id, revoked").eq("premium_key", pk).maybeSingle();
    if (e3) return json({ valid: false, reason: "server_error" });
    if (!row) return json({ valid: false, reason: "not_found" });
    if (row.revoked) return json({ valid: false, reason: "revoked" });
    if (row.license_id && row.license_id !== lic.id) return json({ valid: false, reason: "already_used" });

    if (!row.license_id) {
      // usa a chave só se ninguém a usou nesse meio tempo
      const { data: upd, error: e4 } = await sb.from("premium_keys")
        .update({ license_id: lic.id, redeemed_at: new Date().toISOString() })
        .eq("id", row.id).is("license_id", null).select("id");
      if (e4) return json({ valid: false, reason: "server_error" });
      if (!upd || !upd.length) return json({ valid: false, reason: "already_used" });
    }
    return json({ valid: true });
  } catch (_e) {
    return json({ valid: false, reason: "server_error" });
  }
});
