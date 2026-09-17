const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");

const APP_NAME = "Gringotts Trading Journal";
app.setName(APP_NAME);
// Decoupled from the display name on purpose — a future rename must never
// move or orphan the user's existing database.
app.setPath("userData", path.join(app.getPath("appData"), "GringottsTradingJournal"));

let mainWindow = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Server did not start in time"));
        else setTimeout(attempt, 200);
      });
      req.on("timeout", () => req.destroy());
    }
    attempt();
  });
}

function appResourcesDir() {
  // Packaged: Contents/Resources/app (placed there via electron-builder's extraResources).
  // Unpackaged (local `electron .` test run): the standalone output produced by `npm run build:electron`.
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..", ".next", "standalone");
}

async function startServer() {
  const port = await getFreePort();
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.TJ_DATA_DIR = app.getPath("userData");
  process.env.NODE_ENV = "production";

  const serverDir = appResourcesDir();
  process.chdir(serverDir);
  // The standalone server.js starts listening as a side effect of being required.
  require(path.join(serverDir, "server.js"));

  await waitForServer(port);
  // Next.js sets process.title to "next-server (vX.Y.Z)" as a side effect of
  // starting its server. Since we run it in-process rather than spawning it,
  // that overwrites what macOS shows as the app's name in the menu bar —
  // reset it back now that Next has finished its own startup.
  process.title = APP_NAME;
  return port;
}

async function createWindow() {
  const port = await startServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#0b0b0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error("Failed to start app:", err);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
