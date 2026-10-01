// Runs after the apps are assembled (server injected, arm64 + x64 merged if universal).
//
// Why signing is a separate step: electron-builder renames the app and helpers and we then copy the
// server into Resources, which invalidates Electron's original signature ("code has no resources but
// signature indicates they must be present"). Gatekeeper hard-rejects a broken signature on a
// downloaded copy with no way to override it.
//
// Two modes:
//  * Developer ID + notarization (no first-launch prompt on any Mac). Enabled when MAC_SIGN_IDENTITY is
//    set, for example "Developer ID Application: Your Name (TEAMID)". Notarization also needs
//    APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID, or NOTARY_KEYCHAIN_PROFILE.
//  * Ad-hoc (default). Valid signature, but macOS asks the user to approve the app once ("Open Anyway").
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (process.platform !== "darwin") {
  console.log("Skipping signing (not on macOS).");
  process.exit(0);
}

const require = createRequire(import.meta.url);

function findApp() {
  const releaseDir = path.join(process.cwd(), "release");
  const archDir = readdirSync(releaseDir).find((f) => f.startsWith("mac"));
  if (!archDir) throw new Error(`No mac-* build output found under ${releaseDir}.`);
  const bundle = readdirSync(path.join(releaseDir, archDir)).find((f) => f.endsWith(".app"));
  if (!bundle) throw new Error(`No .app bundle found under ${path.join(releaseDir, archDir)}.`);
  return path.join(releaseDir, archDir, bundle);
}

const app = process.argv[2] ?? findApp();
if (!existsSync(app)) throw new Error(`No app bundle at ${app}.`);

const identity = process.env.MAC_SIGN_IDENTITY;

if (!identity) {
  console.log(`→ Ad-hoc signing ${app}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
  console.log("✓ Signature valid (ad-hoc). Users will see a one-time approval prompt on first launch.");
  process.exit(0);
}

const { signAsync } = require("@electron/osx-sign");
const { notarize } = require("@electron/notarize");
const entitlements = path.join(process.cwd(), "electron", "entitlements.mac.plist");

console.log(`→ Signing ${app} with "${identity}" (hardened runtime)`);
await signAsync({
  app,
  identity,
  platform: "darwin",
  optionsForFile: () => ({ hardenedRuntime: true, entitlements, timestamp: undefined }),
});
execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });

const profile = process.env.NOTARY_KEYCHAIN_PROFILE;
const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
if (profile || (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID)) {
  console.log("→ Submitting to Apple for notarization (this can take several minutes)...");
  await notarize({
    tool: "notarytool",
    appPath: app,
    ...(profile
      ? { keychainProfile: profile }
      : { appleId: APPLE_ID, appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD, teamId: APPLE_TEAM_ID }),
  });
  execFileSync("xcrun", ["stapler", "staple", app], { stdio: "inherit" });
  execFileSync("xcrun", ["stapler", "validate", app], { stdio: "inherit" });
  console.log("✓ Notarized and stapled. It opens on any Mac without a prompt.");
} else {
  console.log("✓ Signed with Developer ID, but NOT notarized (no notarization credentials set), so Gatekeeper will still prompt.");
}
