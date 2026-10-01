// electron-builder's global `files` ignore patterns (needed to keep the
// project's own node_modules out of app.asar) also strip node_modules from
// its `extraResources` copy step, since both share the same ignore list. So
// instead we let electron-builder produce an empty app shell, then copy the
// standalone Next.js server in ourselves with a plain fs copy, no matcher magic.
import { existsSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const releaseDir = path.join(root, "release");

if (!existsSync(standaloneDir)) {
  throw new Error("Missing .next/standalone. Run `npm run build:electron` first.");
}

// Pass the .app path explicitly when more than one architecture has been packaged.
let appPath = process.argv[2];
if (!appPath) {
  const archDir = readdirSync(releaseDir).find((f) => f.startsWith("mac"));
  if (!archDir) {
    throw new Error(`No mac-* build output found under ${releaseDir}.`);
  }
  const appBundle = readdirSync(path.join(releaseDir, archDir)).find((f) => f.endsWith(".app"));
  if (!appBundle) {
    throw new Error(`No .app bundle found under ${path.join(releaseDir, archDir)}.`);
  }
  appPath = path.join(releaseDir, archDir, appBundle);
}
if (!existsSync(appPath)) throw new Error(`No app bundle at ${appPath}.`);

const targetDir = path.join(appPath, "Contents", "Resources", "app");
console.log(`→ Copying standalone server into ${targetDir}`);
cpSync(standaloneDir, targetDir, { recursive: true });
console.log("✓ Resources injected");
