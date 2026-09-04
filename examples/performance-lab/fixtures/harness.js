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

window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin || event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.type !== "rect:benchmark-run") return;
  try {
    const result = await run(message.config);
    window.parent.postMessage(
      { type: "rect:benchmark-result", runId: message.runId, result },
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
