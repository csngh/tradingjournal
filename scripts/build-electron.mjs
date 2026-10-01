import { execSync } from "node:child_process";
import { existsSync, cpSync, rmSync, writeFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

function run(cmd) {
  console.log(`→ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

// Which chip the bundled native module is compiled for. `--skip-next` reuses the Next build already
// in .next (the JavaScript is identical for every chip; only better-sqlite3 differs).
const archArg = process.argv.find((a) => a.startsWith("--arch="))?.split("=")[1];
const arch = archArg ?? (process.arch === "arm64" ? "arm64" : "x64");
if (!["arm64", "x64"].includes(arch)) throw new Error(`Unsupported --arch=${arch} (use arm64 or x64).`);
const skipNext = process.argv.includes("--skip-next");
console.log(`→ Target architecture: ${arch}`);

if (skipNext) {
  console.log("→ Reusing the existing Next.js build (--skip-next)...");
} else {
  console.log("→ Building Next.js (standalone output)...");
  execSync("npx next build", {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ELECTRON_BUILD: "1" },
  });
}

if (!existsSync(standaloneDir)) {
  throw new Error("Standalone output not found at .next/standalone. Check next.config.ts.");
}

// Defense in depth: the real trade database must never ship inside the app,
// even if file tracing ever regresses and pulls in ./data again.
const leakedDataDir = path.join(standaloneDir, "data");
if (existsSync(leakedDataDir)) {
  console.warn(
    `⚠ Found ${leakedDataDir} in the standalone output. Removing it. ` +
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
// staging dir (never the project's own node_modules, which must stay built
// for the system Node the web/dev server runs under), then swap the result in.
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
// built for the system Node, not Electron), so the existing prebuild and
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
  `npx electron-rebuild --module-dir "${stagingDir}" --only better-sqlite3 --force --build-from-source --version 44.4.1 --arch ${arch}`
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

// Fail loudly if the compiled binary is for the wrong chip; a mismatched native module only shows
// up as a crash on the customer's Mac.
const fileInfo = execSync(`file "${rebuiltBinary}"`).toString();
const expected = arch === "arm64" ? "arm64" : "x86_64";
if (!fileInfo.includes(expected)) {
  throw new Error(`Expected a ${expected} binary but got: ${fileInfo.trim()}`);
}
console.log(`✓ better-sqlite3 compiled for ${expected}`);

console.log("→ Swapping the Electron-built binary into the standalone bundle...");
const targetModuleDir = path.join(standaloneDir, "node_modules", "better-sqlite3");
rmSync(targetModuleDir, { recursive: true, force: true });
cpSync(path.join(stagingDir, "node_modules", "better-sqlite3"), targetModuleDir, {
  recursive: true,
});
rmSync(stagingDir, { recursive: true, force: true });

// Keep only what better-sqlite3 needs at runtime: its JS, package.json and the compiled addon. The
// rest (C sources, object files, makefiles, prebuilds) differs per chip and is dead weight, and
// leftover per-chip files would stop the arm64 and x64 apps from being merged into one universal app.
{
  const keep = new Set(["lib", "package.json", "build"]);
  for (const entry of readdirSync(targetModuleDir)) {
    if (!keep.has(entry)) rmSync(path.join(targetModuleDir, entry), { recursive: true, force: true });
  }
  const buildDir = path.join(targetModuleDir, "build");
  for (const entry of readdirSync(buildDir)) {
    if (entry !== "Release") rmSync(path.join(buildDir, entry), { recursive: true, force: true });
  }
  const releaseDir = path.join(buildDir, "Release");
  for (const entry of readdirSync(releaseDir)) {
    if (entry !== "better_sqlite3.node") rmSync(path.join(releaseDir, entry), { recursive: true, force: true });
  }
}

// Turbopack's `serverExternalPackages` output (.next/node_modules/<pkg>-<hash>)
// is a SYMLINK back to the absolute build-time path. It does not survive
// moving/copying the standalone bundle elsewhere, or the original .next
// folder being cleaned up later, which breaks the packaged app with
// "Cannot find module" at runtime. Replace each such symlink with a real,
// self-contained copy of the (now Electron-rebuilt) module it points at.
const externalModulesDir = path.join(standaloneDir, ".next", "node_modules");
if (existsSync(externalModulesDir)) {
  console.log("→ Resolving externalized native module symlinks into real copies...");
  for (const entry of readdirSync(externalModulesDir)) {
    const entryPath = path.join(externalModulesDir, entry);
    const isSymlink = lstatSync(entryPath).isSymbolicLink();
    // A second architecture pass finds real copies left by the first pass; always refresh those
    // from the module just built so a stale binary for the other chip can never ship.
    if (!isSymlink && !entry.startsWith("better-sqlite3")) continue;
    const realTarget = entry.startsWith("better-sqlite3") ? targetModuleDir : realpathSync(entryPath);
    console.log(`  ${entry} -> ${realTarget}`);
    rmSync(entryPath, { recursive: true, force: true });
    cpSync(realTarget, entryPath, { recursive: true, dereference: true });
  }
}

// Last line of defence: every compiled binary in the bundle must match the target chip. A stray
// binary for the other architecture (for example sharp, pulled in from the build machine) would
// crash or be dead weight on the customer's Mac.
console.log(`→ Checking every native binary is ${expected}...`);
const wrong = execSync(
  `find "${standaloneDir}" -type f \\( -name "*.node" -o -name "*.dylib" -o -perm -u+x \\) -print0 | xargs -0 file 2>/dev/null | grep "Mach-O" | grep -v "${expected}" || true`
)
  .toString()
  .trim();
if (wrong) {
  throw new Error(`Found binaries that are not ${expected}:\n${wrong}`);
}
console.log("✓ All native binaries match the target architecture");

console.log("✓ Electron app resources ready in .next/standalone");
