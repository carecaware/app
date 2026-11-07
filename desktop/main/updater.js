// Atualização automática do BarFácil (Windows).
// Consulta as versões publicadas em https://github.com/carecaware/releases,
// pergunta ao usuário se quer instalar, baixa (conferindo o hash SHA-512 que
// vem no latest.yml) e instala.
const { app, dialog } = require("electron");

const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
let asking = false;
let manualWin = null;

function setup(getWin) {
  // só em app instalado (em desenvolvimento não há o que atualizar)
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require("electron-updater")); } catch (e) { return; }

  autoUpdater.autoDownload = false;          // pergunta antes de baixar
  autoUpdater.autoInstallOnAppQuit = false;  // só instala se o usuário aceitar
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("update-available", async (info) => {
    if (asking) return;
    asking = true;
    const win = getWin();
    try {
      const r = await dialog.showMessageBox(win || undefined, {
        type: "question",
        title: "Atualização disponível",
        message: "Nova versão " + info.version + " do BarFácil disponível.",
        detail: "Deseja instalar agora? O app será fechado e reaberto automaticamente. Seus dados são mantidos.",
        buttons: ["Instalar agora", "Depois"],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (r.response === 0) {
        if (win) win.setProgressBar(2); // indeterminado até começar a baixar
        autoUpdater.downloadUpdate().catch(() => { if (win) win.setProgressBar(-1); fail(win); });
      }
    } finally { asking = false; }
  });

  autoUpdater.on("download-progress", (p) => {
    const win = getWin();
    if (win) win.setProgressBar(Math.max(0, Math.min(1, (p.percent || 0) / 100)));
  });

  autoUpdater.on("update-downloaded", () => {
    const win = getWin();
    if (win) win.setProgressBar(-1);
    // instala em silêncio e reabre o app
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });

  autoUpdater.on("error", () => { /* sem internet ou servidor fora: tenta de novo mais tarde */ });

  const check = () => { autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 15000);          // 15 s depois de abrir
  setInterval(check, CHECK_EVERY_MS); // e a cada 12 h com o app aberto
}

function fail(win) {
  dialog.showMessageBox(win || undefined, {
    type: "warning",
    title: "Atualização",
    message: "Não foi possível baixar a atualização agora.",
    detail: "Verifique a internet. O app tentará de novo mais tarde."
  }).catch(() => {});
}

module.exports = { setup };
