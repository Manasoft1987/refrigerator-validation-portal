import { build } from "esbuild";

await build({
  entryPoints: ["server/_core/vercelHandler.ts"],
  outfile: "api/generated.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["pdfkit"],
  banner: {
    js: "import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);",
  },
  sourcemap: false,
  logLevel: "info",
});
