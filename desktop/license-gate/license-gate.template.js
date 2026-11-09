// ---------------------------------------------------------------------
// Tela de ativação de licença.
// Este arquivo é um TEMPLATE: o script de build (build/obfuscate-build.js)
// substitui os marcadores de URL, chave e plataforma (sublinhado duplo, no código abaixo)
// pelos valores reais antes de injetar isso no HTML final.
//
// Como funciona:
//  - Guarda a chave de licença e um "device_id" (gerado uma vez, aleatório)
//    no localStorage.
//  - Se já validou com sucesso há menos de OFFLINE_GRACE_DAYS dias, libera
//    o app na hora (não trava o uso por falta de internet) e revalida em
//    segundo plano.
//  - NOVO: o gate não bloqueia mais. O app roda 7 dias de teste sem chave; a tela de
//    "período de teste acabou" e a de ativação ficam no próprio app, que usa window.bfLic
//    (activate / recheck) e lê o estado gravado em "bf_lic_state".
// ---------------------------------------------------------------------
(function () {
  var SUPABASE_FUNCTION_URL = "__SUPABASE_URL__/functions/v1/validate-license";
  var SUPABASE_ANON_KEY = "__SUPABASE_ANON_KEY__";
  var PLATFORM = "__PLATFORM__"; // "windows" ou "mobile"
  var OFFLINE_GRACE_DAYS = 7;
  var REVALIDATE_EVERY_MS = 12 * 60 * 60 * 1000; // revalida também com o app aberto

  var LS_KEY = "license_key_v1";
  var LS_DEVICE = "license_device_id_v1";
  var LS_VALID_UNTIL = "license_valid_until_v1";
  var LS_STATE = "bf_lic_state";
  var LS_PW_UNLOCK = "bf_pw_unlock"; // até quando o suporte liberou a entrada sem senha (ms)

  // configuração que o app usa para ativar a chave premium (função redeem-premium)
  window.bfCfg = { url: "__SUPABASE_URL__", anon: SUPABASE_ANON_KEY, getKey: function () { try { return localStorage.getItem(LS_KEY) || ""; } catch (e) { return ""; } }, getDevice: function () { return getDeviceId(); } };

  // o suporte libera a entrada sem senha pelo Supabase (coluna pw_unlock_until); o app lê este valor
  function noteUnlock(res) {
    try {
      if (res && res.valid) {
        if (res.unlock_until) localStorage.setItem(LS_PW_UNLOCK, String(res.unlock_until));
        else localStorage.removeItem(LS_PW_UNLOCK);
        // premium: o app Básico vira Premium quando a licença tem uma chave premium (ver migration-005.sql)
        if (res.tier === "premium") localStorage.setItem("bf_premium", "1");
        else localStorage.removeItem("bf_premium");
        // estado da assinatura lido pelo app (tipo, teste, validade, início do premium, volta para a básica)
        localStorage.setItem(LS_STATE, JSON.stringify({ tier: res.tier || "basic", trial: !!res.trial, exp: res.expires_at || 0,
          since: res.premium_since || 0, down: res.downgrade_at || 0, t: Date.now() }));
      }
    } catch (e) {}
  }

  function uid() {
    return "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function getDeviceId() {
    // versão desktop: identificador estável do computador, fornecido pelo
    // processo principal do Electron (não se perde se os dados forem limpos).
    if (window.barDevice && window.barDevice.id) return window.barDevice.id;
    var id = localStorage.getItem(LS_DEVICE);
    if (!id) {
      id = uid();
      localStorage.setItem(LS_DEVICE, id);
    }
    return id;
  }

  function cachedStillValid() {
    var until = parseInt(localStorage.getItem(LS_VALID_UNTIL) || "0", 10);
    return until > Date.now();
  }

  function extendCache() {
    var until = Date.now() + OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(LS_VALID_UNTIL, String(until));
  }

  function clearCache() {
    localStorage.removeItem(LS_VALID_UNTIL);
  }

  // ID aleatório das versões antigas (se existir): o servidor o troca pelo ID
  // estável do computador sem gastar uma segunda ativação.
  function legacyId() {
    var id = localStorage.getItem(LS_DEVICE);
    return id && id !== getDeviceId() ? id : null;
  }

  function callValidate(key, deviceId, action) {
    return fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ license_key: key, platform: PLATFORM, device_id: deviceId, legacy_device_id: legacyId(), action: action || "validate" })
    }).then(function (r) {
      return r.json().then(function (j) { if (j && typeof j === "object") j._status = r.status; return j; });
    });
  }

  function reasonText(res) {
    var reason = res && res.reason;
    if (reason === "not_found") return "Chave não encontrada.";
    if (reason === "revoked") return "Esta chave foi desativada.";
    if (reason === "expired") return "Esta chave expirou.";
    if (reason === "wrong_platform") return "Esta chave não é válida para esta versão do app.";
    if (reason === "limit_reached") return "Esta chave já está ativa em outro aparelho.";
    if (reason === "release_limit") return "Limite de trocas de aparelho atingido neste ano. Fale com o suporte.";
    if (reason === "server_error" || reason === "bad_request") return "Servidor indisponível no momento. Tente novamente em instantes.";
    return "Chave inválida.";
  }

  // Só derruba a assinatura quando o servidor responde de forma DEFINITIVA.
  // Erro temporário, sem internet ou resposta estranha: mantém o estado gravado.
  var DEFINITIVE = { revoked: 1, not_found: 1, wrong_platform: 1, expired: 1 };

  function dropLicense() {
    try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_VALID_UNTIL); localStorage.removeItem("bf_premium"); } catch (e) {}
  }

  function silentRevalidate() {
    var key = localStorage.getItem(LS_KEY);
    if (!key) return Promise.resolve();
    return callValidate(key, getDeviceId()).then(function (res) {
      if (res && res.valid) { extendCache(); noteUnlock(res); }
      else if (res && DEFINITIVE[res.reason]) {
        dropLicense();
        window.dispatchEvent(new CustomEvent("bf-lic-changed"));
      }
    }).catch(function () {});
  }

  // API usada pelo app: ativa uma chave (action "release" troca de aparelho). Devolve a resposta do servidor.
  window.bfLic = {
    platform: PLATFORM,
    reasonText: reasonText,
    getKey: function () { try { return localStorage.getItem(LS_KEY) || ""; } catch (e) { return ""; } },
    getDevice: function () { return getDeviceId(); },
    activate: function (key, action) {
      key = String(key || "").trim().toUpperCase();
      return callValidate(key, getDeviceId(), action).then(function (res) {
        if (res && res.valid) { localStorage.setItem(LS_KEY, key); extendCache(); noteUnlock(res); }
        return res;
      });
    },
    // pede para voltar à versão básica na data de faturamento (função schedule-downgrade)
    scheduleDowngrade: function () {
      return fetch("__SUPABASE_URL__/functions/v1/schedule-downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY },
        body: JSON.stringify({ license_key: window.bfLic.getKey(), device_id: getDeviceId() })
      }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) return silentRevalidate().then(function () { return j; }); return j; });
    },
    recheck: silentRevalidate
  };
  window.bfRecheckLicense = function () { return silentRevalidate(); };

  // ---- ponto de entrada: só revalida em segundo plano; nunca bloqueia ----
  silentRevalidate();
  setInterval(silentRevalidate, REVALIDATE_EVERY_MS);
  window.addEventListener("online", silentRevalidate);
})();
