# Browser performance lab

The GitHub Pages performance lab is an evidence surface for Rect, not a leaderboard.

## Horizon 1 comparison workload

The cross-framework comparison owns one workload only: reactive text fan-out.

1. Mount `N` text cells at value `0`.
2. Verify the first and last cell.
3. Warm the update path.
4. Update one shared value repeatedly.
5. Verify the final first and last cell.
6. Record mount and update distributions plus observable browser evidence.

This workload is useful because Rect has an explicit semantic contract for exactly this operation. Conditional regions, hydration, and other features do not enter the comparison until Rect owns and tests those semantics and equivalent comparison fixtures exist.

## Rect keyed movement workload

Keyed collections now have a separate Rect-only browser workload. It deliberately does not extend the framework comparison or make a framework-ranking claim.

Each measured sample starts from one canonical keyed list and exercises one movement class:

1. append one new key;
2. prepend one new key;
3. rotate the list by half its length;
4. remove every fourth item;
5. reverse the entire key order as the adversarial movement case.

Scenario input construction happens before the timer starts. The timed region contains only the source setter and the synchronous keyed reconciliation it triggers; correctness inspection happens after the timer stops.

A sample is accepted only if the browser fixture verifies all of the following after the operation:

- resulting key order exactly matches the scenario contract;
- reactive item/index text matches the new positions;
- every key retained from the baseline keeps the same DOM node identity.

The fixture records p50/p95/p99 operation latency and MutationObserver record counts independently for each movement class. MutationObserver records are browser observations, not a normalized work unit.

## Fixtures

- **Rect** uses the reference runtime with one text node per fan-out cell. Repeated uses of the same accessor share one tracked fan-out effect and one text conversion per update. No Rect compiler exists yet.
- **Rect keyed** is built as a separate `rect-keyed.js` entrypoint around Rect's tested `keyed()` region. Keyed runtime and workload helpers therefore do not contribute to the existing fan-out fixture's application-bundle byte measurement.
- **Vanilla DOM** is the low-level imperative reference for the fan-out comparison.
- **React 19.2.8** is built with Bun 1.4's built-in React Compiler and measured with synchronous `flushSync` updates for the fan-out comparison.
- **Preact 10.29.8** uses the real renderer with its debounce scheduler made synchronous for the fan-out measurement boundary.
- **Solid 1.9.15** uses Solid-owned signals/render lifetime and direct DOM effects in the same fine-grained shape its compiler targets. It is intentionally described as compiler-shaped rather than claiming an official Solid compiler pass.

## Frozen comparison boundary

Comparison-only runtimes live in the private `benchmarks/comparison` workspace. React, React DOM, Preact, and Solid are pinned to exact versions there and resolved through the repository's root `bun.lock`; they do not become dependencies of `@rect/core`.

Every fan-out fixture is built locally with the same Bun 1.4 browser target, ESM output, minification setting, and `packages: "bundle"` policy. The fixture runner has no browser import map and no CDN package resolution. React's fixture still uses Bun's built-in React Compiler, while the current Solid fixture remains explicitly compiler-shaped rather than an official Solid compiler output.

The Pages build emits `fixtures/manifest.json` with:

- the source revision represented by the build;
- the pinned Bun/build policy;
- the comparison workspace and lockfile boundary;
- exact comparison package versions;
- each emitted fixture asset and its byte size.

`bun run verify:comparison` fails closed if the runner regains an import map/CDN runtime, a comparison dependency leaks into `@rect/core`, an emitted asset retains a bare comparison-runtime import, or manifest byte evidence disagrees with the built artifact.

## Published protocol browser acceptance

The Pages gate also owns a bounded real-browser acceptance layer. Playwright is pinned in the comparison workspace and drives its matching Chromium build against the already-built `dist/pages` artifacts rather than a source-development server.

`bun run verify:comparison:browser` verifies all of the following without adding performance thresholds:

- the browser-visible manifest is exactly the manifest emitted by the build;
- every published fixture asset is served with the byte count recorded in that manifest;
- the existing fan-out protocol runs for Rect, vanilla DOM, React + React Compiler, Preact, and Solid with a small fixed smoke configuration;
- every fan-out result passes the fixture's first/last-node correctness checks and reports bundle bytes matching the corresponding manifest asset;
- React, Preact, and Solid report the exact versions pinned by the comparison workspace;
- the Rect-only keyed protocol runs all five movement classes and preserves its existing correctness gate;
- the expected fixture assets are actually loaded through the published runner;
- page errors, console errors, or unexpected external HTTP(S) runtime requests fail the acceptance run.

The smoke configuration checks protocol semantics and evidence shape only. Measured latency values must be finite observations, but they are not compared with baselines, budgets, or framework rankings.

## Measurements

The fan-out comparison keeps dimensions independent:

- first mount latency;
- warm mount p50/p95/p99;
- update p50/p95/p99;
- mutation-observer records per update;
- self-contained fixture application bundle bytes, including the framework runtime for framework fixtures;
- cross-origin runtime transfer bytes when Resource Timing exposes them; after the normalized local boundary this should normally be unavailable because comparison runtimes are bundled locally;
- JavaScript heap delta when the browser exposes `performance.memory`.

The keyed Rect-only workload separately reports:

- operation latency p50/p95/p99 for each movement class;
- MutationObserver record p50/p95/p99 for each movement class;
- fail-closed correctness verification for order, reactive text, and retained DOM identity.

A missing browser metric is reported as unavailable rather than replaced by an estimate.

## Interpretation boundary

The browser page is exploratory performance evidence. Hardware, browser version, background work, thermal state, JIT state, and extension activity can all move measurements. Do not turn a Pages run into a universal "X times faster" claim.

The normalized dependency/build boundary makes bundle bytes reproducible and removes CDN cache/network differences from framework-runtime loading. Real-browser protocol acceptance proves that the published artifacts still execute the declared correctness/evidence contract; it does not make latency measurements universal or prove that the framework fixtures are compiler-equivalent.

The keyed workload establishes browser evidence for Rect's own reconciliation behavior only. It does not support a Rect-versus-framework keyed-list claim until equivalent fixtures and correctness contracts exist.

The deterministic `benchmarks/` workload, runtime-profiler capture, and Moonlight baseline/candidate evaluation remain the source-development evidence path.

## Next horizon

Continue normalizing the comparison without touching Rect runtime semantics:

1. compile Solid with its official compiler rather than the compiler-shaped fixture;
2. add equivalent batched/multi-value workloads before interpreting framework scheduler behavior;
3. only then promote keyed movement into a cross-framework workload with equivalent correctness contracts;
4. add the Rect compiled fixture once the compiler-assisted path exists.
