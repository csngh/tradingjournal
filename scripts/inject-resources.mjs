// electron-builder's global `files` ignore patterns (needed to keep the
// project's own node_modules out of app.asar) also strip node_modules from
// its `extraResources` copy step, since both share the same ignore list. So
// instead we let electron-builder produce an empty app shell, then copy the
// standalone Next.js server in ourselves — a plain fs copy, no matcher magic.
import { existsSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const releaseDir = path.join(root, "release");

if (!existsSync(standaloneDir)) {
  throw new Error("Missing .next/standalone — run `npm run build:electron` first.");
}

const archDir = readdirSync(releaseDir).find((f) => f.startsWith("mac"));
if (!archDir) {
  throw new Error(`No mac-* build output found under ${releaseDir}.`);
}

const appBundle = readdirSync(path.join(releaseDir, archDir)).find((f) => f.endsWith(".app"));
if (!appBundle) {
  throw new Error(`No .app bundle found under ${path.join(releaseDir, archDir)}.`);
}

const targetDir = path.join(releaseDir, archDir, appBundle, "Contents", "Resources", "app");
console.log(`→ Copying standalone server into ${targetDir}`);
cpSync(standaloneDir, targetDir, { recursive: true });
console.log("✓ Resources injected");
