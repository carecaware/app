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
//  - Caso contrário, mostra uma tela cheia pedindo a chave, chama a Edge
//    Function do Supabase, e só libera o app se a resposta for válida.
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
        '<button id="lg-release" style="display:none;margin-top:10px;background:#4a3520;color:#f4ece0">Usar neste aparelho (desativar o antigo)</button>' +
      '</div>';
    document.documentElement.appendChild(wrap);
    return wrap;
  }

  function showOverlayAndHandle() {
    var overlay = buildOverlay();
    var input = overlay.querySelector("#lg-input");
    var btn = overlay.querySelector("#lg-submit");
    var msg = overlay.querySelector("#lg-msg");
    var relBtn = overlay.querySelector("#lg-release");
    var pendingKey = null;
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
            extendCache();
            overlay.remove();
          } else {
            btn.disabled = false;
            msg.className = "lg-msg err";
            msg.textContent = reasonText(res);
            pendingKey = (res && res.reason === "limit_reached" && res.can_release) ? key : null;
            relBtn.style.display = pendingKey ? "block" : "none";
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
      if (reason === "limit_reached") return "Esta licença já está ativa em outro aparelho.";
      if (reason === "release_limit") return "Limite de trocas de aparelho atingido neste ano. Fale com o suporte.";
      if (reason === "server_error" || reason === "bad_request") return "Servidor indisponível no momento. Tente novamente em instantes.";
      // motivo desconhecido: mostra o que o servidor respondeu, pra facilitar o diagnóstico
      var detail = res && (res.detail || res.reason || res.message || res.error || res.code || ("HTTP " + res._status));
      return "Chave inválida." + (detail ? " (" + detail + ")" : "");
    }

    // hífens automáticos: o cliente digita só letras/números e o campo
    // insere "-" a cada GROUP caracteres (também ao colar a chave inteira)
    var GROUP = 4;
    function formatKey(raw) {
      var c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      var out = [];
      for (var i = 0; i < c.length; i += GROUP) out.push(c.slice(i, i + GROUP));
      return out.join("-");
    }
    input.addEventListener("input", function () {
      var v = formatKey(input.value);
      if (v !== input.value) input.value = v;
    });
    if (input.value) input.value = formatKey(input.value);

    relBtn.addEventListener("click", function () {
      if (!pendingKey) return;
      if (!window.confirm("O aparelho antigo deixará de funcionar com esta licença. Continuar?")) return;
      relBtn.disabled = true;
      callValidate(pendingKey, deviceId, "release").then(function (res) {
        relBtn.disabled = false;
        if (res && res.valid) {
          localStorage.setItem(LS_KEY, pendingKey);
          extendCache();
          overlay.remove();
        } else {
          msg.className = "lg-msg err";
          msg.textContent = reasonText(res);
          relBtn.style.display = "none";
        }
      }).catch(function () {
        relBtn.disabled = false;
        msg.className = "lg-msg err";
        msg.textContent = "Não foi possível conectar. Verifique sua internet e tente de novo.";
      });
    });
    btn.addEventListener("click", trySubmit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") trySubmit();
    });
  }

  // Só derruba a licença quando o servidor responde de forma DEFINITIVA.
  // Erro temporário, sem internet ou resposta estranha: mantém o cache.
  var DEFINITIVE = { revoked: 1, not_found: 1, wrong_platform: 1, limit_reached: 1 };

  function silentRevalidate() {
    var key = localStorage.getItem(LS_KEY);
    if (!key) return;
    callValidate(key, getDeviceId()).then(function (res) {
      if (res && res.valid) {
        extendCache();
      } else if (res && DEFINITIVE[res.reason]) {
        clearCache();
        if (!document.getElementById("license-gate-overlay")) showOverlayAndHandle();
      }
      // qualquer outra resposta (server_error, etc.): ignora.
    }).catch(function () {
      // sem internet: mantém o cache como está, não derruba o usuário no meio do uso.
    });
  }

  // ---- ponto de entrada ----
  if (cachedStillValid()) {
    silentRevalidate();
    setInterval(function () { if (cachedStillValid()) silentRevalidate(); }, REVALIDATE_EVERY_MS);
    window.addEventListener("online", silentRevalidate);
  } else {
    showOverlayAndHandle();
  }
})();
