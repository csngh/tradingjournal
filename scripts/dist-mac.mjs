// Builds the shareable DMG for Apple Silicon Macs (M1 and later). Intel Macs are not supported.
// Usage: node scripts/dist-mac.mjs
import { execSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const PRODUCT = "Gringotts Trading Journal";
const releaseDir = path.join(root, "release");

function run(cmd) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

// Clear old outputs so the folder only ever holds the current build.
if (existsSync(releaseDir)) {
  for (const f of readdirSync(releaseDir)) {
    if (f.endsWith(".dmg") || f.endsWith(".dmg.blockmap")) rmSync(path.join(releaseDir, f), { force: true });
  }
}

const app = path.join(releaseDir, "mac-arm64", `${PRODUCT}.app`);
run("node scripts/build-electron.mjs --arch=arm64");
run("npx electron-builder --mac --dir --arm64");
if (!existsSync(app)) throw new Error(`Expected packaged app at ${app}.`);
run(`node scripts/inject-resources.mjs "${app}"`);
run(`node scripts/sign-mac.mjs "${app}"`);
run(`npx electron-builder --mac dmg --arm64 --prepackaged "${app}"`);
console.log("\n✓ Done. The DMG is in the release/ folder.");
