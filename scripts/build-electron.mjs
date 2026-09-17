import { execSync } from "node:child_process";
import { existsSync, cpSync, rmSync, writeFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

function run(cmd) {
  console.log(`→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

console.log("→ Building Next.js (standalone output)...");
execSync("npx next build", {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, ELECTRON_BUILD: "1" },
});

if (!existsSync(standaloneDir)) {
  throw new Error("Standalone output not found at .next/standalone — check next.config.ts.");
}

// Defense in depth: the real trade database must never ship inside the app,
// even if file tracing ever regresses and pulls in ./data again.
const leakedDataDir = path.join(standaloneDir, "data");
if (existsSync(leakedDataDir)) {
  console.warn(
    `⚠ Found ${leakedDataDir} in the standalone output — removing it. ` +
      "This should not happen (see outputFileTracingExcludes in next.config.ts); please double check."
  );
  rmSync(leakedDataDir, { recursive: true, force: true });
}

console.log("→ Copying public/ and static assets into the standalone bundle...");
cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
});

console.log("→ Copying drizzle migrations...");
rmSync(path.join(standaloneDir, "drizzle"), { recursive: true, force: true });
cpSync(path.join(root, "drizzle"), path.join(standaloneDir, "drizzle"), { recursive: true });

// Next's dependency tracing only copies the files better-sqlite3 needs at
// require-time (no binding.gyp/src), which electron-rebuild can't detect or
// rebuild. So we rebuild a full, untouched copy of the module in an isolated
// staging dir — never the project's own node_modules, which must stay built
// for the system Node the web/dev server runs under — then swap the result in.
console.log("→ Rebuilding better-sqlite3 for Electron's ABI in an isolated staging dir...");
const stagingDir = path.join(root, ".next", "native-staging");
rmSync(stagingDir, { recursive: true, force: true });
cpSync(
  path.join(root, "node_modules", "better-sqlite3"),
  path.join(stagingDir, "node_modules", "better-sqlite3"),
  { recursive: true }
);
// better-sqlite3's binding.gyp skips compilation whenever a prebuilt binary
// for the *running* Node already exists (it can't tell that prebuild was
// built for the system Node, not Electron) — so the existing prebuild and
// any stale build/ output must be removed to force a real compile.
rmSync(path.join(stagingDir, "node_modules", "better-sqlite3", "prebuilds"), {
  recursive: true,
  force: true,
});
rmSync(path.join(stagingDir, "node_modules", "better-sqlite3", "build"), {
  recursive: true,
  force: true,
});
writeFileSync(
  path.join(stagingDir, "package.json"),
  JSON.stringify(
    { name: "native-staging", version: "1.0.0", private: true, dependencies: { "better-sqlite3": "13.0.3" } },
    null,
    2
  )
);
run(
  `npx electron-rebuild --module-dir "${stagingDir}" --only better-sqlite3 --force --build-from-source --version 44.4.1`
);

const rebuiltBinary = path.join(
  stagingDir,
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node"
);
if (!existsSync(rebuiltBinary)) {
  throw new Error(`Expected a freshly compiled binary at ${rebuiltBinary} but found none.`);
}

console.log("→ Swapping the Electron-built binary into the standalone bundle...");
const targetModuleDir = path.join(standaloneDir, "node_modules", "better-sqlite3");
rmSync(targetModuleDir, { recursive: true, force: true });
cpSync(path.join(stagingDir, "node_modules", "better-sqlite3"), targetModuleDir, {
  recursive: true,
});
rmSync(stagingDir, { recursive: true, force: true });

// Turbopack's `serverExternalPackages` output (.next/node_modules/<pkg>-<hash>)
// is a SYMLINK back to the absolute build-time path — it does not survive
// moving/copying the standalone bundle elsewhere, or the original .next
// folder being cleaned up later, which breaks the packaged app with
// "Cannot find module" at runtime. Replace each such symlink with a real,
// self-contained copy of the (now Electron-rebuilt) module it points at.
const externalModulesDir = path.join(standaloneDir, ".next", "node_modules");
if (existsSync(externalModulesDir)) {
  console.log("→ Resolving externalized native module symlinks into real copies...");
  for (const entry of readdirSync(externalModulesDir)) {
    const entryPath = path.join(externalModulesDir, entry);
    if (!lstatSync(entryPath).isSymbolicLink()) continue;
    const realTarget = realpathSync(entryPath);
    console.log(`  ${entry} -> ${realTarget}`);
    rmSync(entryPath, { force: true });
    cpSync(realTarget, entryPath, { recursive: true, dereference: true });
  }
}

console.log("✓ Electron app resources ready in .next/standalone");
