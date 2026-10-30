const { app, BrowserWindow, ipcMain, systemPreferences } = require("electron");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");

const APP_NAME = "Gringotts Trading Journal";

// Must stay identical to SESSION_COOKIE_NAME/SESSION_TOKEN in src/lib/session.ts. Duplicated
// rather than shared because this file is plain Node, loaded directly by Electron with no build
// step, while src/lib/session.ts is bundled as part of the Next.js app. There's no single module
// both sides can import without a cross-directory build hack for two short string constants.
const SESSION_COOKIE_NAME = "gtj_session";
const SESSION_TOKEN = "49d2d45413262f96dea94cd0143813ace2d19fe7cb94e4382411fd071042a71e";

// Without this, launching the app a second time (double-clicking it again in Finder/Launchpad,
// Spotlight, etc.) while it's already running spawns a whole separate OS process. That second
// process would start its OWN server on its OWN port and open its OWN connection to the SAME
// SQLite file as the first: two windows silently editing the same database from two unrelated
// server instances, each unaware of the other's writes, and a real risk of "database is locked"
// under concurrent writes. Must be requested before anything else.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Another instance already holds the lock and will receive our "second-instance" event below;
  // this process has nothing left to do.
  app.quit();
  return;
}

app.setName(APP_NAME);
// Decoupled from the display name on purpose. A future rename must never
// move or orphan the user's existing database.
app.setPath("userData", path.join(app.getPath("appData"), "GringottsTradingJournal"));

let mainWindow = null;
// Guards against a double window if the Dock icon is double-clicked fast enough to fire two
// "activate" events before the first createWindow() call has actually constructed its window.
let openingWindow = false;

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

// The standalone server.js starts listening as a side effect of being `require()`'d, but Node
// caches modules by resolved path, so a second `require()` is a silent no-op: it does NOT start a
// second listener. Closing the window on macOS (the app stays running, as apps normally do) and
// then reopening it from the Dock used to call this per window, picking a *new* free port each
// time and waiting for *that* port to answer, which nothing ever did, since the real server was
// still on the original port. That wait silently timed out and the window never reappeared. Fixed
// by starting the server at most once per app launch and handing every window the same port.
let serverPortPromise = null;

function startServerOnce() {
  if (!serverPortPromise) {
    serverPortPromise = (async () => {
      const port = await getFreePort();
      process.env.PORT = String(port);
      process.env.HOSTNAME = "127.0.0.1";
      process.env.TJ_DATA_DIR = app.getPath("userData");
      process.env.NODE_ENV = "production";

      const serverDir = appResourcesDir();
      process.chdir(serverDir);
      require(path.join(serverDir, "server.js"));

      await waitForServer(port);
      // Next.js sets process.title to "next-server (vX.Y.Z)" as a side effect of
      // starting its server. Since we run it in-process rather than spawning it,
      // that overwrites what macOS shows as the app's name in the menu bar.
      // Reset it back now that Next has finished its own startup.
      process.title = APP_NAME;
      return port;
    })();
  }
  return serverPortPromise;
}

async function createWindow() {
  if (openingWindow) return;
  openingWindow = true;
  try {
    const port = await startServerOnce();

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 640,
      title: APP_NAME,
      backgroundColor: "#0b0b0f",
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 18, y: 20 },
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  } finally {
    openingWindow = false;
  }
}

function focusExistingWindow() {
  if (!mainWindow) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return true;
}

// Touch ID is invoked here in the main process, never in the renderer: only native code can reach
// the Secure Enclave, and `contextIsolation` deliberately keeps the web page from touching Electron
// or Node APIs directly (see preload.js). A successful prompt proves the person at the keyboard is
// enrolled on this Mac. It isn't a password, so it can't be "decrypted" into one. Instead, on
// success, the main process sets the exact same session cookie the password flow sets after a
// correct `verifyPassword()` call, directly through Electron's session API, with no extra HTTP
// endpoint added for it. There is deliberately no way to set this cookie except: (a) the password
// check in src/app/unlock/actions.ts, or (b) a real Touch ID success right here.
//
// `ipcMain.handle` alone doesn't check WHO is calling: any frame with the preload script attached
// could invoke this channel. This app never navigates anywhere outside its own local server today,
// so there is nothing else that could call it, but this capability can mint a valid session, so
// it's checked explicitly anyway rather than relying on "nothing else happens to be able to reach
// it" as the only guard. Checked against the EXACT port this app's own server resolved to, not just
// the 127.0.0.1 hostname: a loopback-hostname-only check would equally accept any other local
// server a future change might ever navigate this window to.
async function callerIsOurOwnServer(event) {
  try {
    const ownPort = await startServerOnce();
    const url = new URL(event.senderFrame.url);
    return url.hostname === "127.0.0.1" && Number(url.port) === ownPort;
  } catch {
    return false;
  }
}

ipcMain.handle("touch-id:available", () => {
  return process.platform === "darwin" && systemPreferences.canPromptTouchID();
});

ipcMain.handle("touch-id:unlock", async (event) => {
  if (!(await callerIsOurOwnServer(event))) {
    return { ok: false, error: "Touch ID isn't available here." };
  }
  if (process.platform !== "darwin" || !systemPreferences.canPromptTouchID()) {
    return { ok: false, error: "Touch ID isn't available on this Mac." };
  }
  try {
    await systemPreferences.promptTouchID(`unlock ${APP_NAME}`);
  } catch {
    // Cancelled, failed, or no fingerprint enrolled. The password field stays available either way.
    return { ok: false, error: "Touch ID didn't succeed." };
  }

  const port = await startServerOnce();
  await event.sender.session.cookies.set({
    url: `http://127.0.0.1:${port}/`,
    name: SESSION_COOKIE_NAME,
    value: SESSION_TOKEN,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Deliberately no expirationDate: matches the password flow's true session cookie, so quitting
    // and relaunching the app still re-locks it.
  });
  return { ok: true };
});

// Fires on the already-running (first) process when a second launch attempt was blocked above.
app.on("second-instance", () => {
  if (focusExistingWindow()) return;
  createWindow().catch((err) => {
    console.error("Failed to open window for a second launch attempt:", err);
  });
});

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error("Failed to start app:", err);
    app.quit();
  });

  app.on("activate", () => {
    if (focusExistingWindow()) return;
    createWindow().catch((err) => {
      console.error("Failed to reopen window:", err);
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
