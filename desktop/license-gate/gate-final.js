// ---------------------------------------------------------------------
// Tela de ativação de licença.
// Este arquivo é um TEMPLATE: o script de build (build/obfuscate-build.js)
// substitui os placeholders https://sydjqruprgixevqcrhdv.supabase.co, sb_publishable_-Ht37rNyJ83bWWpuZSe37g_HnENbcI9 e
// windows pelos valores reais antes de injetar isso no HTML final.
//
// Como funciona:
//  - Guarda a chave de licença e um "device_id" (gerado uma vez, aleatório)
//    no localStorage.
//  - Se já validou com sucesso há menos de OFFLINE_GRACE_DAYS dias, libera
//    o app na hora (não trava o uso por falta de internet) e revalida em
//    segundo plano.
//  - Caso contrário, mostra uma tela cheia pedindo a chave, chama a Edge
//    Function do Supabase, e só libera o app se a resposta for válida.
// ---------------------------------------------------------------------
(function () {
  var SUPABASE_FUNCTION_URL = "https://sydjqruprgixevqcrhdv.supabase.co/functions/v1/validate-license";
  var SUPABASE_ANON_KEY = "sb_publishable_-Ht37rNyJ83bWWpuZSe37g_HnENbcI9";
  var PLATFORM = "windows"; // "windows" ou "mobile"
  var OFFLINE_GRACE_DAYS = 3;

  var LS_KEY = "license_key_v1";
  var LS_DEVICE = "license_device_id_v1";
  var LS_VALID_UNTIL = "license_valid_until_v1";
  var LS_PW_UNLOCK = "bf_pw_unlock"; // até quando o suporte liberou a entrada sem senha (ms)

  // o suporte libera a entrada sem senha pelo Supabase (coluna pw_unlock_until); o app lê este valor
  function noteUnlock(res) {
    try {
      if (res && res.valid) {
        if (res.unlock_until) localStorage.setItem(LS_PW_UNLOCK, String(res.unlock_until));
        else localStorage.removeItem(LS_PW_UNLOCK);
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

  function callValidate(key, deviceId) {
    return fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ license_key: key, platform: PLATFORM, device_id: deviceId })
    }).then(function (r) {
      return r.json().then(function (j) { if (j && typeof j === "object") j._status = r.status; return j; });
    });
  }

  function buildOverlay() {
    var wrap = document.createElement("div");
    wrap.id = "license-gate-overlay";
    wrap.innerHTML =
      '<style>' +
      '#license-gate-overlay{position:fixed;inset:0;z-index:999999;background:#15100a;' +
      'color:#f4ece0;display:flex;align-items:center;justify-content:center;' +
      'font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;padding:20px;}' +
      '#license-gate-overlay .lg-box{width:100%;max-width:360px;background:#241a10;' +
      'border:1px solid #4a3520;border-radius:14px;padding:26px 22px;box-shadow:0 10px 40px rgba(0,0,0,.5);}' +
      '#license-gate-overlay h1{font-size:19px;margin:0 0 6px;}' +
      '#license-gate-overlay p{font-size:13px;color:#c9b79c;margin:0 0 18px;line-height:1.5;}' +
      '#license-gate-overlay input{width:100%;box-sizing:border-box;padding:12px 14px;' +
      'font-size:16px;letter-spacing:1px;border-radius:8px;border:1px solid #4a3520;' +
      'background:#15100a;color:#f4ece0;margin-bottom:12px;text-transform:uppercase;}' +
      '#license-gate-overlay input:focus{outline:none;border-color:#e8a33d;}' +
      '#license-gate-overlay button{width:100%;padding:12px;font-size:14px;font-weight:600;' +
      'border:none;border-radius:8px;background:#e8a33d;color:#1a140c;cursor:pointer;}' +
      '#license-gate-overlay button:disabled{opacity:.6;cursor:default;}' +
      '#license-gate-overlay .lg-msg{margin-top:12px;font-size:13px;min-height:18px;}' +
      '#license-gate-overlay .lg-msg.err{color:#e07a5f;}' +
      '#license-gate-overlay .lg-msg.ok{color:#8fbf7f;}' +
      '</style>' +
      '<div class="lg-box">' +
        '<h1>Ativação necessária</h1>' +
        '<p>Digite a chave de licença que você recebeu na compra para liberar o app.</p>' +
        '<input id="lg-input" type="text" placeholder="XXXX-XXXX-XXXX-XXXX" autofocus>' +
        '<button id="lg-submit">Ativar</button>' +
        '<div class="lg-msg" id="lg-msg"></div>' +
      '</div>';
    document.documentElement.appendChild(wrap);
    return wrap;
  }

  function showOverlayAndHandle() {
    var overlay = buildOverlay();
    var input = overlay.querySelector("#lg-input");
    var btn = overlay.querySelector("#lg-submit");
    var msg = overlay.querySelector("#lg-msg");
    var deviceId = getDeviceId();

    var savedKey = localStorage.getItem(LS_KEY);
    if (savedKey) input.value = savedKey;

    function trySubmit() {
      var key = (input.value || "").trim().toUpperCase();
      if (!key) return;
      btn.disabled = true;
      msg.className = "lg-msg";
      msg.textContent = "Verificando...";
      callValidate(key, deviceId)
        .then(function (res) {
          if (res && res.valid) {
            localStorage.setItem(LS_KEY, key);
            extendCache(); noteUnlock(res);
            overlay.remove();
          } else {
            btn.disabled = false;
            msg.className = "lg-msg err";
            msg.textContent = reasonText(res);
          }
        })
        .catch(function () {
          btn.disabled = false;
          msg.className = "lg-msg err";
          msg.textContent = "Não foi possível conectar. Verifique sua internet e tente de novo.";
        });
    }

    function reasonText(res) {
      var reason = res && res.reason;
      if (reason === "not_found") return "Chave não encontrada.";
      if (reason === "revoked") return "Esta chave foi desativada.";
      if (reason === "wrong_platform") return "Esta chave não é válida para esta versão do app.";
      if (reason === "limit_reached") return "Esta chave já atingiu o limite de dispositivos ativados.";
      // motivo desconhecido: mostra o que o servidor respondeu, pra facilitar o diagnóstico
      var detail = res && (res.detail || res.reason || res.message || res.error || res.code || ("HTTP " + res._status));
      return "Chave inválida." + (detail ? " (" + detail + ")" : "");
    }

    btn.addEventListener("click", trySubmit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") trySubmit();
    });
  }

  function silentRevalidate() {
    var key = localStorage.getItem(LS_KEY);
    if (!key) return;
    return callValidate(key, getDeviceId()).then(function (res) {
      if (res && res.valid) {
        extendCache(); noteUnlock(res);
      } else {
        // a chave foi revogada ou algo mudou: força nova ativação na
        // próxima abertura do app.
        clearCache();
      }
    }).catch(function () {
      // sem internet: mantém o cache como está, não derruba o usuário no meio do uso.
    });
  }

  // a tela de login do app chama isto ao tocar em "Esqueci minha senha"
  window.bfRecheckLicense = function () { var p = silentRevalidate(); return p || Promise.resolve(); };

  // ---- ponto de entrada ----
  if (cachedStillValid()) {
    // libera o app imediatamente e revalida sem bloquear a tela.
    silentRevalidate();
  } else {
    showOverlayAndHandle();
  }
})();
