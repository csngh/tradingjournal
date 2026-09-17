import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: process.env.ELECTRON_BUILD ? "standalone" : undefined,
  serverExternalPackages: ["better-sqlite3"],
  // The local SQLite file lives under ./data at dev/runtime, but that path is
  // only ever computed dynamically (via process.cwd()) — it must never be
  // treated as a build-time asset, or the file tracer can bundle whatever
  // happens to be sitting in ./data (including real trade data) into the
  // standalone output.
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
};

export default nextConfig;
