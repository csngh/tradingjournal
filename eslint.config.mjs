import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Packaged Mac app output (already gitignored) — without this, a project-wide lint also
    // walks the bundled/minified production JS inside it, producing thousands of meaningless
    // warnings from compiled code instead of source.
    "release/**",
  ]),
  {
    // Electron's main process and preload script: plain CommonJS, loaded directly by Node/Electron
    // with no build step, so they genuinely need `require()` — unlike the rest of this project,
    // which is bundled TypeScript where the typescript-eslint rules (including
    // no-require-imports) are meant to apply.
    files: ["electron/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
