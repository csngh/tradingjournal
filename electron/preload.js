// Runs in the renderer with Node access, before the web page's own scripts, and exposes only this
// narrow, explicit surface to it (contextIsolation stays on, so the page never gets `ipcRenderer`,
// `require`, or anything else). This is the ONLY bridge between the unlock page and the native
// Touch ID prompt, which only the main process can actually invoke.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  touchIDAvailable: () => ipcRenderer.invoke("touch-id:available"),
  unlockWithTouchID: () => ipcRenderer.invoke("touch-id:unlock"),
});
