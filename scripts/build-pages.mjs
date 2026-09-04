import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
process.chdir(repositoryRoot);

const outputRoot = join(repositoryRoot, "dist", "pages");
const fixtureOutput = join(outputRoot, "fixtures");
const assetOutput = join(fixtureOutput, "assets");

async function build(config) {
  const result = await Bun.build({
    target: "browser",
    minify: true,
    sourcemap: "none",
    throw: false,
    ...config,
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("GitHub Pages build failed.");
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(assetOutput, { recursive: true });

await build({
  entrypoints: ["examples/performance-lab/index.html"],
  outdir: outputRoot,
});

const fixtures = [
  { entrypoint: "examples/performance-lab/fixtures/rect.ts" },
  { entrypoint: "examples/performance-lab/fixtures/vanilla.ts" },
  {
    entrypoint: "examples/performance-lab/fixtures/react.jsx",
    reactCompiler: true,
    jsx: {
      development: false,
      factory: "React.createElement",
      fragment: "React.Fragment",
      importSource: "react",
      runtime: "automatic",
      sideEffects: false,
    },
  },
  { entrypoint: "examples/performance-lab/fixtures/preact.js" },
  { entrypoint: "examples/performance-lab/fixtures/solid.js" },
];

for (const fixture of fixtures) {
  await build({
    entrypoints: [fixture.entrypoint],
    outdir: assetOutput,
    format: "esm",
    naming: "[name].[ext]",
    packages: "external",
    reactCompiler: fixture.reactCompiler ?? false,
    jsx: fixture.jsx,
  });
}

await cp("examples/performance-lab/fixtures/runner.html", join(fixtureOutput, "runner.html"));
await cp("examples/performance-lab/fixtures/harness.js", join(fixtureOutput, "harness.js"));
await Bun.write(join(outputRoot, ".nojekyll"), "");
