import { resolve, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
  frameworkIds,
  keyedScenarioIds,
} from "../../examples/performance-lab/benchmark-contract.ts";
import {
  comparisonBrowserContract,
  comparisonDependencyVersions,
  comparisonFixtureIds,
} from "./contract.ts";

const repositoryRoot = dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
const pagesRoot = resolve(repositoryRoot, "dist", "pages");
const manifestPath = resolve(pagesRoot, "fixtures", "manifest.json");
const manifestFile = Bun.file(manifestPath);

function fail(message) {
  throw new Error(`Published comparison protocol verification failed: ${message}`);
}

function sameJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function assertFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${label} must be a finite non-negative number`);
  }
}

function assertDistribution(value, label) {
  if (!value || typeof value !== "object") fail(`${label} is missing`);
  for (const percentile of ["p50", "p95", "p99"]) {
    assertFiniteNumber(value[percentile], `${label}.${percentile}`);
  }
}

if (!(await manifestFile.exists())) {
  fail("dist/pages/fixtures/manifest.json is missing; build Pages before browser verification");
}

const manifest = await manifestFile.json();
const manifestFixtureIds = manifest.fixtures?.map((fixture) => fixture.id) ?? [];
if (!sameJson(manifestFixtureIds, comparisonFixtureIds)) {
  fail("published manifest fixture order does not match the comparison contract");
}

const port = Number(process.env.RECT_COMPARISON_PORT ?? "4173");
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  fail("RECT_COMPARISON_PORT must be a valid TCP port");
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const candidate = resolve(pagesRoot, `.${pathname}`);
    if (candidate !== pagesRoot && !candidate.startsWith(`${pagesRoot}${sep}`)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(candidate);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    return new Response(file);
  },
});

const origin = new URL(server.url).origin;
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const page = await browser.newPage();
  const externalRequests = new Set();
  const requestedPaths = new Set();
  const pageErrors = [];
  const consoleErrors = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin !== origin) externalRequests.add(url.href);
    else requestedPaths.add(url.pathname);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`${origin}/`, { waitUntil: "networkidle" });

  const publishedManifest = await page.evaluate(async () => {
    const response = await fetch("fixtures/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Manifest request failed with ${response.status}.`);
    return await response.json();
  });
  if (!sameJson(publishedManifest, manifest)) {
    fail("browser-visible manifest differs from the built manifest on disk");
  }

  const publishedAssetBytes = await page.evaluate(async (fixtures) => {
    const entries = [];
    for (const fixture of fixtures) {
      const response = await fetch(`fixtures/${fixture.asset}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${fixture.id} asset request failed with ${response.status}.`);
      }
      entries.push([fixture.id, (await response.arrayBuffer()).byteLength]);
    }
    return entries;
  }, publishedManifest.fixtures);
  const publishedBytesById = new Map(publishedAssetBytes);
  for (const fixture of manifest.fixtures) {
    if (publishedBytesById.get(fixture.id) !== fixture.bundleBytes) {
      fail(`${fixture.id} browser-served bytes differ from manifest evidence`);
    }
  }

  requestedPaths.clear();

  await page.getByLabel("Reactive text nodes").fill(String(comparisonBrowserContract.fanout.nodes));
  await page.getByLabel("Measured updates").fill(String(comparisonBrowserContract.fanout.updates));
  await page.getByRole("button", { name: "Run all benchmarks" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('section[aria-labelledby="benchmark-title"] .progress')
        ?.textContent?.trim()
        .startsWith("Finished "),
    undefined,
    { timeout: 60_000 },
  );

  const fanoutText = await page
    .locator('section[aria-labelledby="evidence-title"] pre')
    .textContent();
  if (!fanoutText) fail("fan-out evidence output is empty");
  const fanoutResults = JSON.parse(fanoutText);
  if (!Array.isArray(fanoutResults) || fanoutResults.length !== frameworkIds.length) {
    fail("fan-out run did not return one result per framework");
  }

  const manifestById = new Map(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
  const expectedVersions = {
    react: comparisonDependencyVersions.react,
    preact: comparisonDependencyVersions.preact,
    solid: comparisonDependencyVersions["solid-js"],
  };

  for (let index = 0; index < frameworkIds.length; index += 1) {
    const framework = frameworkIds[index];
    const result = fanoutResults[index];
    if (!result || result.framework !== framework) {
      fail(`fan-out result ${index} does not match framework ${framework}`);
    }
    if (result.verified !== true) fail(`${framework} fan-out correctness verification failed`);
    if (!sameJson(result.config, comparisonBrowserContract.fanout)) {
      fail(`${framework} fan-out config drifted from the browser acceptance contract`);
    }

    assertFiniteNumber(result.firstMountMs, `${framework}.firstMountMs`);
    assertDistribution(result.mountMs, `${framework}.mountMs`);
    assertDistribution(result.updateMs, `${framework}.updateMs`);
    assertFiniteNumber(result.mutationsPerUpdate, `${framework}.mutationsPerUpdate`);

    const fixture = manifestById.get(framework);
    if (!fixture || result.appBundleBytes !== fixture.bundleBytes) {
      fail(`${framework} result bytes do not match the published manifest`);
    }
    if (result.runtimeTransferBytes !== null) {
      fail(`${framework} unexpectedly reported an external comparison-runtime transfer`);
    }

    const expectedVersion = expectedVersions[framework];
    if (expectedVersion && result.version !== expectedVersion) {
      fail(`${framework} reported ${result.version} instead of pinned version ${expectedVersion}`);
    }

    const expectedAssetPath = `/fixtures/${fixture.asset}`;
    if (!requestedPaths.has(expectedAssetPath)) {
      fail(`${framework} fixture asset was not loaded through the published runner`);
    }
  }

  requestedPaths.clear();

  await page.getByLabel("Keyed items").fill(String(comparisonBrowserContract.keyed.items));
  await page
    .getByLabel("Samples per scenario")
    .fill(String(comparisonBrowserContract.keyed.samples));
  await page.getByRole("button", { name: "Run keyed workload" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('section[aria-labelledby="keyed-benchmark-title"] .progress')
        ?.textContent?.trim()
        .startsWith("Finished "),
    undefined,
    { timeout: 60_000 },
  );

  const keyedText = await page
    .locator('section[aria-labelledby="keyed-evidence-title"] pre')
    .textContent();
  if (!keyedText) fail("keyed evidence output is empty");
  const keyedResult = JSON.parse(keyedText);
  if (keyedResult.framework !== "rect" || keyedResult.verified !== true) {
    fail("Rect keyed published protocol did not verify successfully");
  }
  if (!sameJson(keyedResult.config, comparisonBrowserContract.keyed)) {
    fail("Rect keyed config drifted from the browser acceptance contract");
  }

  const scenarioIds = keyedResult.scenarios?.map((scenario) => scenario.scenario) ?? [];
  if (!sameJson(scenarioIds, keyedScenarioIds)) {
    fail("Rect keyed scenario order drifted from the published protocol contract");
  }
  for (const scenario of keyedResult.scenarios) {
    if (scenario.verified !== true)
      fail(`${scenario.scenario} keyed correctness verification failed`);
    assertDistribution(scenario.latencyMs, `${scenario.scenario}.latencyMs`);
    assertDistribution(scenario.mutationRecords, `${scenario.scenario}.mutationRecords`);
  }

  const keyedFixture = manifestById.get("rect-keyed");
  if (!keyedFixture || !requestedPaths.has(`/fixtures/${keyedFixture.asset}`)) {
    fail("Rect keyed fixture asset was not loaded through the published runner");
  }

  if (externalRequests.size > 0) {
    fail(`published harness requested external origins: ${[...externalRequests].join(", ")}`);
  }
  if (pageErrors.length > 0) fail(`page errors observed: ${pageErrors.join(" | ")}`);
  if (consoleErrors.length > 0) fail(`console errors observed: ${consoleErrors.join(" | ")}`);

  console.log(
    JSON.stringify({
      schemaVersion: 1,
      status: "passed",
      sourceRevision: manifest.sourceRevision,
      browser: comparisonBrowserContract.browser,
      browserVersion,
      fanoutFrameworks: frameworkIds,
      keyedScenarios: keyedScenarioIds,
      externalRequests: 0,
    }),
  );
} finally {
  if (browser) await browser.close();
  server.stop(true);
}
