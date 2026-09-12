import { expect, test } from "bun:test";

import {
  comparisonBrowserContract,
  comparisonBuildContract,
  comparisonDependencyVersions,
  comparisonFixtureIds,
} from "../../benchmarks/comparison/contract.ts";

const rootPackage = await Bun.file(new URL("../../package.json", import.meta.url)).json();
const comparisonPackage = await Bun.file(
  new URL("../../benchmarks/comparison/package.json", import.meta.url),
).json();
const runner = await Bun.file(
  new URL("../../examples/performance-lab/fixtures/runner.html", import.meta.url),
).text();

test("comparison runtimes are isolated in one exact-version workspace", () => {
  expect(rootPackage.workspaces).toContain("benchmarks/comparison");
  expect(comparisonPackage.packageManager).toBe(`bun@${comparisonBuildContract.bunVersion}`);
  expect(comparisonPackage.dependencies).toEqual(comparisonDependencyVersions);

  for (const dependency of Object.keys(comparisonDependencyVersions)) {
    expect(rootPackage.dependencies?.[dependency]).toBeUndefined();
    expect(rootPackage.devDependencies?.[dependency]).toBeUndefined();
  }
});

test("comparison browser tooling stays pinned and outside Rect core", () => {
  expect(comparisonPackage.devDependencies?.playwright).toBe(
    comparisonBrowserContract.playwrightVersion,
  );
  expect(rootPackage.dependencies?.playwright).toBeUndefined();
  expect(rootPackage.devDependencies?.playwright).toBeUndefined();
  expect(rootPackage.scripts?.["verify:comparison:browser"]).toBe(
    "bun benchmarks/comparison/verify-published-protocol.mjs",
  );
});

test("browser fixture runner has no comparison-runtime import map", () => {
  expect(runner).not.toContain("esm.sh");
  expect(runner).not.toContain('type="importmap"');
});

test("comparison build contract is explicit and complete", () => {
  expect(comparisonBuildContract).toEqual({
    schemaVersion: 1,
    bunVersion: "1.4.0",
    target: "browser",
    format: "esm",
    minify: true,
    packages: "bundle",
  });
  expect(comparisonFixtureIds).toEqual([
    "rect",
    "rect-keyed",
    "vanilla",
    "react",
    "preact",
    "solid",
  ]);
});

test("published browser acceptance uses bounded semantic smoke inputs", () => {
  expect(comparisonBrowserContract).toEqual({
    playwrightVersion: "1.63.0",
    browser: "chromium",
    fanout: {
      nodes: 10,
      updates: 5,
      mountSamples: 15,
      warmupUpdates: 5,
    },
    keyed: {
      items: 10,
      samples: 5,
      warmupSamples: 5,
    },
  });
});
