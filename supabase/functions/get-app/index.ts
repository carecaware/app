// Edge Function: get-app
// Corpo: { license_key, platform: "web", device_id }
// Se a licença for válida, devolve o HTML do app (guardado no bucket privado
// "app-payload", arquivo app.html). Senão devolve JSON { ok:false, reason }.
//
// Implantação: supabase functions deploy get-app --no-verify-jwt
// (no painel: deixe "Verify JWT" DESLIGADO, como na validate-license)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const fail = (reason: string) =>
  new Response(JSON.stringify({ ok: false, reason }), { headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { license_key, platform, device_id } = await req.json();
    if (!license_key || !device_id || platform !== "web") return fail("bad_request");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: lic, error } = await sb.from("licenses")
      .select("id, platform, max_activations, revoked, expires_at")
      .eq("license_key", String(license_key).trim().toUpperCase()).maybeSingle();
    if (error) return fail("server_error");
    if (!lic) return fail("not_found");
    if (lic.revoked) return fail("revoked");
    if (lic.platform !== "web") return fail("wrong_platform");
    if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) return fail("expired");

    const now = new Date().toISOString();
    const { data: acts, error: e2 } = await sb.from("license_activations").select("id, device_id").eq("license_id", lic.id);
    if (e2) return fail("server_error");
    const list = acts || [];
    const mine = list.find((a) => a.device_id === device_id);
    if (mine) {
      await sb.from("license_activations").update({ last_seen_at: now, platform: "web" }).eq("id", mine.id);
    } else if (list.length < lic.max_activations) {
      await sb.from("license_activations").insert({ license_id: lic.id, device_id, last_seen_at: now, platform: "web" });
    } else {
      return fail("limit_reached");
    }

    const { data: file, error: e3 } = await sb.storage.from("app-payload").download("app.html");
    if (e3 || !file) return fail("server_error");
    return new Response(await file.text(), {
      headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (_e) {
    return fail("server_error");
  }
});
