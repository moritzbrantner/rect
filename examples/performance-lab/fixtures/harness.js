const framework = new URLSearchParams(window.location.search).get("framework");
const validFrameworks = new Set(["rect", "vanilla", "react", "preact", "solid"]);
const target = document.querySelector("#fixture");

if (!framework || !validFrameworks.has(framework)) throw new Error("Unknown benchmark framework.");
if (!(target instanceof HTMLElement)) throw new Error("Missing benchmark fixture root.");

const adapterModule = await import(`./assets/${framework}.js`);
const adapter = adapterModule.default;

function percentile(values, quantile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index];
}

function distribution(values) {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

function heapUsed() {
  const memory = performance.memory;
  return memory && typeof memory.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null;
}

function runtimeTransferBytes() {
  let total = 0;
  let measurable = false;
  for (const entry of performance.getEntriesByType("resource")) {
    let url;
    try {
      url = new URL(entry.name);
    } catch {
      continue;
    }
    if (url.hostname !== "esm.sh") continue;
    const bytes = entry.encodedBodySize || entry.transferSize || 0;
    if (bytes > 0) measurable = true;
    total += bytes;
  }
  return measurable ? total : null;
}

async function appBundleBytes() {
  try {
    const response = await fetch(adapter.assetUrl, { cache: "force-cache" });
    if (!response.ok) return null;
    return (await response.arrayBuffer()).byteLength;
  } catch {
    return null;
  }
}

function assertFixture(instance, expected) {
  const first = instance.readFirst();
  const last = instance.readLast();
  if (first !== expected || last !== expected) {
    throw new Error(`Correctness check failed: expected ${expected}, got ${first}/${last}.`);
  }
}

function assertKeyedFixture(beforeEntries, afterEntries, expectedEntries) {
  if (afterEntries.length !== expectedEntries.length) {
    throw new Error(
      `Keyed correctness check failed: expected ${expectedEntries.length} items, got ${afterEntries.length}.`,
    );
  }

  const beforeByKey = new Map(beforeEntries.map((entry) => [entry.key, entry.node]));
  for (let index = 0; index < expectedEntries.length; index += 1) {
    const expected = expectedEntries[index];
    const actual = afterEntries[index];
    if (!expected || !actual) throw new Error("Keyed correctness check lost an expected row.");
    if (actual.key !== expected.id) {
      throw new Error(
        `Keyed order check failed at ${index}: expected ${expected.id}, got ${actual.key}.`,
      );
    }
    if (actual.text !== `${index}:${expected.label}`) {
      throw new Error(
        `Keyed reactive text check failed for ${expected.id}: expected ${index}:${expected.label}, got ${actual.text}.`,
      );
    }

    const previousNode = beforeByKey.get(actual.key);
    if (previousNode && previousNode !== actual.node) {
      throw new Error(`Keyed DOM identity check failed for retained key ${actual.key}.`);
    }
  }
}

async function run(config) {
  const mountSamples = [];
  let firstMountMs = 0;

  for (let index = 0; index <= config.mountSamples; index += 1) {
    target.replaceChildren();
    const start = performance.now();
    const instance = adapter.mount(target, config.nodes);
    const duration = performance.now() - start;
    assertFixture(instance, "0");
    if (index === 0) firstMountMs = duration;
    else mountSamples.push(duration);
    instance.dispose();
  }

  target.replaceChildren();
  const heapStart = heapUsed();
  const instance = adapter.mount(target, config.nodes);

  for (let index = 1; index <= config.warmupUpdates; index += 1) instance.update(index);
  assertFixture(instance, String(config.warmupUpdates));

  const observer = new MutationObserver(() => undefined);
  observer.observe(target, { subtree: true, characterData: true, childList: true });

  const updateSamples = [];
  let mutationCount = 0;
  const base = config.warmupUpdates;
  for (let index = 1; index <= config.updates; index += 1) {
    const nextValue = base + index;
    const start = performance.now();
    instance.update(nextValue);
    updateSamples.push(performance.now() - start);
    mutationCount += observer.takeRecords().length;
  }
  observer.disconnect();

  const expected = String(base + config.updates);
  assertFixture(instance, expected);
  const heapEnd = heapUsed();

  const result = {
    framework,
    label: adapter.label,
    version: adapter.version,
    implementation: adapter.implementation,
    config,
    firstMountMs,
    mountMs: distribution(mountSamples),
    updateMs: distribution(updateSamples),
    mutationsPerUpdate: config.updates === 0 ? 0 : mutationCount / config.updates,
    appBundleBytes: await appBundleBytes(),
    runtimeTransferBytes: runtimeTransferBytes(),
    heapDeltaBytes: heapStart === null || heapEnd === null ? null : heapEnd - heapStart,
    verified: true,
    notes: adapter.notes,
  };

  instance.dispose();
  target.replaceChildren();
  return result;
}

function runKeyedOperation(instance, scenario, sample) {
  instance.resetKeyed();
  const beforeEntries = instance.readKeyedEntries();
  const expectedEntries = instance.prepareKeyed(scenario, sample);
  const observer = new MutationObserver(() => undefined);
  observer.observe(target, { subtree: true, characterData: true, childList: true });

  const start = performance.now();
  instance.applyKeyed(expectedEntries);
  const latencyMs = performance.now() - start;
  const mutationRecords = observer.takeRecords().length;
  observer.disconnect();

  const afterEntries = instance.readKeyedEntries();
  assertKeyedFixture(beforeEntries, afterEntries, expectedEntries);
  return { latencyMs, mutationRecords };
}

async function runKeyed(config) {
  if (framework !== "rect") {
    throw new Error("Keyed benchmark is available only for the Rect reference fixture.");
  }

  const keyedAdapterModule = await import("./assets/rect-keyed.js");
  const keyedAdapter = keyedAdapterModule.default;
  if (typeof keyedAdapter.mount !== "function") {
    throw new Error("Rect keyed benchmark has no mount implementation.");
  }
  if (!Array.isArray(keyedAdapter.keyedScenarios) || keyedAdapter.keyedScenarios.length === 0) {
    throw new Error("Rect keyed benchmark has no declared scenarios.");
  }

  target.replaceChildren();
  const instance = keyedAdapter.mount(target, config.items);
  try {
    const scenarios = [];
    for (const scenario of keyedAdapter.keyedScenarios) {
      for (let sample = 0; sample < config.warmupSamples; sample += 1) {
        runKeyedOperation(instance, scenario, sample);
      }

      const latencySamples = [];
      const mutationSamples = [];
      for (let sample = 0; sample < config.samples; sample += 1) {
        const measured = runKeyedOperation(instance, scenario, config.warmupSamples + sample);
        latencySamples.push(measured.latencyMs);
        mutationSamples.push(measured.mutationRecords);
      }

      scenarios.push({
        scenario,
        latencyMs: distribution(latencySamples),
        mutationRecords: distribution(mutationSamples),
        verified: true,
      });
    }

    return {
      framework: "rect",
      config,
      scenarios,
      verified: true,
      notes: [
        "Each measured operation starts from the same baseline ordering.",
        "Correctness requires expected key order, reactive item/index text, and DOM identity for every retained key.",
        "Mutation counts are MutationObserver records, not a normalized browser work unit.",
        "This is Rect-only browser evidence and does not support a cross-framework performance ranking.",
      ],
    };
  } finally {
    instance.dispose();
    target.replaceChildren();
  }
}

window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin || event.source !== window.parent) return;
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type !== "rect:benchmark-run" && message.type !== "rect:keyed-benchmark-run") return;

  try {
    const result =
      message.type === "rect:keyed-benchmark-run"
        ? await runKeyed(message.config)
        : await run(message.config);
    window.parent.postMessage(
      {
        type:
          message.type === "rect:keyed-benchmark-run"
            ? "rect:keyed-benchmark-result"
            : "rect:benchmark-result",
        runId: message.runId,
        result,
      },
      window.location.origin,
    );
  } catch (error) {
    window.parent.postMessage(
      {
        type: "rect:benchmark-error",
        runId: message.runId,
        message: error instanceof Error ? error.message : String(error),
      },
      window.location.origin,
    );
  }
});

window.parent.postMessage({ type: "rect:benchmark-ready", framework }, window.location.origin);
