// Processo principal do Electron.
// Mantém a janela simples, sem integração com Node no lado do app (renderer),
// sem menu padrão, e bloqueia os atalhos mais óbvios de abrir o DevTools —
// isso não é uma proteção "à prova de bala" (ver README), mas remove o
// acesso casual de um clique.

const { app, BrowserWindow, Menu, globalShortcut, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

// ---------------------------------------------------------------------
// Identificador estável do computador (para o limite de dispositivos da
// licença). Vem do MachineGuid do Windows: não muda se os dados do app
// forem limpos ou o app for reinstalado. Se não der para ler, cai para um
// id aleatório salvo em arquivo na pasta de dados do app.
// ---------------------------------------------------------------------
function readMachineGuid() {
  try {
    const out = execFileSync(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", windowsHide: true, timeout: 5000 }
    );
    const m = out.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    return m ? m[1].trim() : null;
  } catch (e) { return null; }
}

function getStableDeviceId() {
  let raw = null;
  if (process.platform === "win32") raw = readMachineGuid();
  if (raw) return "win-" + crypto.createHash("sha256").update("bargestao|" + raw).digest("hex").slice(0, 32);
  const f = path.join(app.getPath("userData"), "device-id.txt");
  try {
    const saved = fs.readFileSync(f, "utf8").trim();
    if (saved) return saved;
  } catch (e) {}
  const id = "file-" + crypto.randomBytes(16).toString("hex");
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, id); } catch (e) {}
  return id;
}

let cachedDeviceId = null;
ipcMain.on("get-device-id", (e) => {
  if (!cachedDeviceId) cachedDeviceId = getStableDeviceId();
  e.returnValue = cachedDeviceId;
});

// ---------------------------------------------------------------------
// Cópia de segurança automática dos dados do bar e da licença, fora do
// armazenamento do navegador. Se esse armazenamento for apagado, os dados
// são restaurados na próxima abertura.
// ---------------------------------------------------------------------
const BACKUP_KEYS = ["barapp_data_v1", "license_key_v1", "license_valid_until_v1", "barapp_muted"];
function backupFile() { return path.join(app.getPath("userData"), "auto-backup.json"); }

async function saveBackup(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const snap = await win.webContents.executeJavaScript(
      "(function(){var o={};" + JSON.stringify(BACKUP_KEYS) + ".forEach(function(k){var v=localStorage.getItem(k);if(v!==null)o[k]=v;});return o;})()"
    );
    if (snap && snap.barapp_data_v1) {
      const tmp = backupFile() + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(snap));
      fs.renameSync(tmp, backupFile());
    }
  } catch (e) {}
}

async function restoreBackupIfNeeded(win) {
  try {
    if (!fs.existsSync(backupFile())) return false;
    const has = await win.webContents.executeJavaScript("localStorage.getItem('barapp_data_v1')!==null");
    if (has) return false;
    const snap = JSON.parse(fs.readFileSync(backupFile(), "utf8"));
    await win.webContents.executeJavaScript(
      "(function(s){Object.keys(s).forEach(function(k){localStorage.setItem(k,s[k]);});})(" + JSON.stringify(snap) + ")"
    );
    return true;
  } catch (e) { return false; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 480,
    minHeight: 640,
    autoHideMenuBar: true,
    title: "SNOOK BAR",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      devTools: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);

  // keep the window title fixed (ignore the title of the loaded HTML page)
  win.on("page-title-updated", (e) => e.preventDefault());

  win.loadFile(path.join(__dirname, "..", "dist-electron-app", "index.html"));

  // restaura a cópia de segurança se o armazenamento do app estiver vazio
  // (recarrega uma única vez), e passa a salvar cópias periodicamente.
  let restoreChecked = false;
  win.webContents.on("did-finish-load", async () => {
    if (!restoreChecked) {
      restoreChecked = true;
      if (await restoreBackupIfNeeded(win)) { win.webContents.reload(); return; }
    }
  });
  const backupTimer = setInterval(() => saveBackup(win), 30000);
  win.on("close", () => { clearInterval(backupTimer); saveBackup(win); });

  win.webContents.on("before-input-event", (event, input) => {
    const key = (input.key || "").toLowerCase();
    const blockCombo =
      (input.control && input.shift && (key === "i" || key === "j" || key === "c")) ||
      key === "f12";
    if (blockCombo) event.preventDefault();
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
