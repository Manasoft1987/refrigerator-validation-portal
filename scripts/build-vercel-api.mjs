import { build } from "esbuild";

await build({
  entryPoints: ["server/_core/vercelHandler.ts"],
  outfile: "api/index.js",
  bundle: true,
  platform: "node",
  packages: "external",
  format: "esm",
  target: "node20",
  sourcemap: false,
  logLevel: "info",
});
