// Expõe ao app (somente leitura) o identificador estável deste computador,
// usado pela tela de licença. O valor é calculado no processo principal.
const { contextBridge, ipcRenderer } = require("electron");
let deviceId = null;
try { deviceId = ipcRenderer.sendSync("get-device-id"); } catch (e) {}
contextBridge.exposeInMainWorld("barDevice", { id: deviceId });
