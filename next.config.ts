import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: process.env.ELECTRON_BUILD ? "standalone" : undefined,
  serverExternalPackages: ["better-sqlite3"],
  // The local SQLite file lives under ./data at dev/runtime, but that path is
  // only ever computed dynamically (via process.cwd()). It must never be
  // treated as a build-time asset, or the file tracer can bundle whatever
  // happens to be sitting in ./data (including real trade data) into the
  // standalone output.
  outputFileTracingExcludes: {
    "*": [
      "./data/**",
      // The packaged app serves its own local logo, so image optimization is switched off (below).
      // Bundling sharp would only ship native binaries for the build machine's chip, which is wrong
      // for the other Mac architecture.
      ...(process.env.ELECTRON_BUILD ? ["./node_modules/sharp/**", "./node_modules/@img/**"] : []),
    ],
  },
  images: process.env.ELECTRON_BUILD ? { unoptimized: true } : undefined,
};

export default nextConfig;
