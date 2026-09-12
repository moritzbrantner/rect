import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  comparisonBuildContract,
  comparisonDependencyVersions,
  comparisonFixtureIds,
} from "../benchmarks/comparison/contract.ts";

const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const fixtureOutput = join(repositoryRoot, "dist", "pages", "fixtures");
const manifest = await Bun.file(join(fixtureOutput, "manifest.json")).json();
const runner = await Bun.file(join(fixtureOutput, "runner.html")).text();
const rootPackage = await Bun.file(join(repositoryRoot, "package.json")).json();
const comparisonPackage = await Bun.file(
  join(repositoryRoot, "benchmarks", "comparison", "package.json"),
).json();

function fail(message) {
  throw new Error(`Comparison boundary verification failed: ${message}`);
}

if (runner.includes("esm.sh") || runner.includes('type="importmap"')) {
  fail("runner still depends on a browser import map or CDN runtime");
}

if (manifest.schemaVersion !== comparisonBuildContract.schemaVersion) {
  fail("manifest schema version does not match the declared contract");
}
if (typeof manifest.sourceRevision !== "string" || !/^[0-9a-f]{40}$/.test(manifest.sourceRevision)) {
  fail("manifest does not contain a full source commit revision");
}
if (manifest.toolchain?.bun !== comparisonBuildContract.bunVersion) {
  fail("manifest does not record the pinned Bun version");
}
if (manifest.toolchain?.packages !== "bundle") {
  fail("fixture packages are not declared as bundled");
}
if (manifest.dependencyBoundary?.externalRuntimeImports !== false) {
  fail("manifest permits external runtime imports");
}

const expectedPackageManager = `bun@${comparisonBuildContract.bunVersion}`;
if (rootPackage.packageManager !== expectedPackageManager) {
  fail(`root packageManager is not ${expectedPackageManager}`);
}
if (comparisonPackage.packageManager !== expectedPackageManager) {
  fail(`comparison packageManager is not ${expectedPackageManager}`);
}

for (const [name, version] of Object.entries(comparisonDependencyVersions)) {
  if (comparisonPackage.dependencies?.[name] !== version) {
    fail(`${name} is not pinned to ${version} in the comparison workspace`);
  }
  if (rootPackage.dependencies?.[name] || rootPackage.devDependencies?.[name]) {
    fail(`${name} leaked into @rect/core dependencies`);
  }
}

const actualFixtureIds = manifest.fixtures?.map((fixture) => fixture.id) ?? [];
if (JSON.stringify(actualFixtureIds) !== JSON.stringify(comparisonFixtureIds)) {
  fail("manifest fixture order does not match the declared contract");
}

const bareRuntimeImport =
  /(?:from\s*|import\s*\(?\s*)["'](?:react(?:-dom)?|preact|solid-js)(?:\/[^"']*)?["']/;

for (const fixture of manifest.fixtures) {
  const assetPath = join(fixtureOutput, fixture.asset);
  const assetStats = await stat(assetPath);
  if (assetStats.size !== fixture.bundleBytes) {
    fail(`${fixture.id} bundle byte evidence does not match the built asset`);
  }

  const source = await Bun.file(assetPath).text();
  if (source.includes("esm.sh")) fail(`${fixture.id} still references esm.sh`);
  if (bareRuntimeImport.test(source)) {
    fail(`${fixture.id} still contains a bare comparison-runtime import`);
  }
}

console.log(
  JSON.stringify({
    schemaVersion: 1,
    status: "passed",
    sourceRevision: manifest.sourceRevision,
    fixtures: manifest.fixtures.map((fixture) => ({
      id: fixture.id,
      bundleBytes: fixture.bundleBytes,
    })),
  }),
);
