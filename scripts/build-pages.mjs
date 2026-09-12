import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  comparisonBuildContract,
  comparisonDependencyVersions,
  comparisonFixtureIds,
} from "../benchmarks/comparison/contract.ts";

const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
process.chdir(repositoryRoot);

const outputRoot = join(repositoryRoot, "dist", "pages");
const fixtureOutput = join(outputRoot, "fixtures");
const assetOutput = join(fixtureOutput, "assets");
const rootPackage = await Bun.file(join(repositoryRoot, "package.json")).json();
const comparisonPackage = await Bun.file(
  join(repositoryRoot, "benchmarks", "comparison", "package.json"),
).json();

function verifyDeclaredBoundary() {
  const expectedPackageManager = `bun@${comparisonBuildContract.bunVersion}`;
  if (rootPackage.packageManager !== expectedPackageManager) {
    throw new Error(`Root package manager must be ${expectedPackageManager}.`);
  }
  if (comparisonPackage.packageManager !== expectedPackageManager) {
    throw new Error(`Comparison package manager must be ${expectedPackageManager}.`);
  }

  for (const [name, version] of Object.entries(comparisonDependencyVersions)) {
    if (comparisonPackage.dependencies?.[name] !== version) {
      throw new Error(`Comparison dependency ${name} must be pinned to ${version}.`);
    }
    if (rootPackage.dependencies?.[name] || rootPackage.devDependencies?.[name]) {
      throw new Error(`Comparison dependency ${name} must stay outside @rect/core dependencies.`);
    }
  }
}

function readRevision(ref) {
  const result = Bun.spawnSync(["git", "rev-parse", ref], {
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;
  return new TextDecoder().decode(result.stdout).trim();
}

function sourceRevision() {
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    return readRevision("HEAD^2") ?? readRevision("HEAD");
  }
  return readRevision("HEAD");
}

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
  return result;
}

verifyDeclaredBoundary();

await rm(outputRoot, { recursive: true, force: true });
await mkdir(assetOutput, { recursive: true });

await build({
  entrypoints: ["examples/performance-lab/index.html"],
  outdir: outputRoot,
});

const fixtures = [
  {
    id: "rect",
    entrypoint: "examples/performance-lab/fixtures/rect.ts",
    dependencies: {},
  },
  {
    id: "rect-keyed",
    entrypoint: "examples/performance-lab/fixtures/rect-keyed.ts",
    dependencies: {},
  },
  {
    id: "vanilla",
    entrypoint: "examples/performance-lab/fixtures/vanilla.ts",
    dependencies: {},
  },
  {
    id: "react",
    entrypoint: "examples/performance-lab/fixtures/react.jsx",
    dependencies: {
      react: comparisonDependencyVersions.react,
      "react-dom": comparisonDependencyVersions["react-dom"],
    },
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
  {
    id: "preact",
    entrypoint: "examples/performance-lab/fixtures/preact.js",
    dependencies: { preact: comparisonDependencyVersions.preact },
  },
  {
    id: "solid",
    entrypoint: "examples/performance-lab/fixtures/solid.js",
    dependencies: { "solid-js": comparisonDependencyVersions["solid-js"] },
  },
];

const actualFixtureIds = fixtures.map((fixture) => fixture.id);
if (JSON.stringify(actualFixtureIds) !== JSON.stringify(comparisonFixtureIds)) {
  throw new Error("Comparison fixture order drifted from the declared build contract.");
}

const fixtureEvidence = [];
for (const fixture of fixtures) {
  await build({
    entrypoints: [fixture.entrypoint],
    outdir: assetOutput,
    format: comparisonBuildContract.format,
    naming: "[name].[ext]",
    packages: comparisonBuildContract.packages,
    reactCompiler: fixture.reactCompiler ?? false,
    jsx: fixture.jsx,
  });

  const asset = `assets/${fixture.id}.js`;
  const assetStats = await stat(join(fixtureOutput, asset));
  fixtureEvidence.push({
    id: fixture.id,
    asset,
    bundleBytes: assetStats.size,
    dependencies: fixture.dependencies,
    reactCompiler: fixture.reactCompiler ?? false,
  });
}

await cp("examples/performance-lab/fixtures/runner.html", join(fixtureOutput, "runner.html"));
await cp("examples/performance-lab/fixtures/harness.js", join(fixtureOutput, "harness.js"));
await Bun.write(
  join(fixtureOutput, "manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: comparisonBuildContract.schemaVersion,
      sourceRevision: sourceRevision(),
      toolchain: {
        bun: comparisonBuildContract.bunVersion,
        target: comparisonBuildContract.target,
        format: comparisonBuildContract.format,
        minify: comparisonBuildContract.minify,
        packages: comparisonBuildContract.packages,
      },
      dependencyBoundary: {
        workspace: "benchmarks/comparison/package.json",
        lockfile: "bun.lock",
        externalRuntimeImports: false,
        packages: comparisonDependencyVersions,
      },
      fixtures: fixtureEvidence,
    },
    null,
    2,
  )}\n`,
);
await Bun.write(join(outputRoot, ".nojekyll"), "");
