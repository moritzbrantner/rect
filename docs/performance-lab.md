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

A sample is accepted only if the browser fixture verifies all of the following after the operation:

- resulting key order exactly matches the scenario contract;
- reactive item/index text matches the new positions;
- every key retained from the baseline keeps the same DOM node identity.

The fixture records p50/p95/p99 operation latency and MutationObserver record counts independently for each movement class. MutationObserver records are browser observations, not a normalized work unit.

## Fixtures

- **Rect** uses the reference runtime with one text node per fan-out cell. Repeated uses of the same accessor share one tracked fan-out effect and one text conversion per update. The keyed workload uses Rect's tested `keyed()` region with stable key-owned DOM ranges. No Rect compiler exists yet.
- **Vanilla DOM** is the low-level imperative reference for the fan-out comparison.
- **React 19.2.8** is built with Bun 1.4's built-in React Compiler and measured with synchronous `flushSync` updates for the fan-out comparison.
- **Preact 10.29.8** uses the real renderer with its debounce scheduler made synchronous for the fan-out measurement boundary.
- **Solid 1.9.15** uses Solid-owned signals/render lifetime and direct DOM effects in the same fine-grained shape its compiler targets. It is intentionally described as compiler-shaped rather than claiming an official Solid compiler pass.

Framework runtime imports are exact-version browser ESM imports in Horizon 1. This avoids adding comparison-only packages to Rect's frozen runtime/tooling lockfile.

## Measurements

The fan-out comparison keeps dimensions independent:

- first mount latency;
- warm mount p50/p95/p99;
- update p50/p95/p99;
- mutation-observer records per update;
- fixture application bundle bytes;
- cross-origin runtime transfer bytes when Resource Timing exposes them;
- JavaScript heap delta when the browser exposes `performance.memory`.

The keyed Rect-only workload separately reports:

- operation latency p50/p95/p99 for each movement class;
- MutationObserver record p50/p95/p99 for each movement class;
- fail-closed correctness verification for order, reactive text, and retained DOM identity.

A missing browser metric is reported as unavailable rather than replaced by an estimate.

## Interpretation boundary

The browser page is exploratory performance evidence. Network cache state, hardware, browser version, background work, thermal state, JIT state, and extension activity can all move measurements. Do not turn a Pages run into a universal "X times faster" claim.

The keyed workload establishes browser evidence for Rect's own reconciliation behavior only. It does not support a Rect-versus-framework keyed-list claim until equivalent fixtures and a frozen comparison boundary exist.

The deterministic `benchmarks/` workload, runtime-profiler capture, and Moonlight baseline/candidate evaluation remain the source-development evidence path.

## Next horizon

Normalize the comparison harness without touching Rect runtime semantics:

1. add a dedicated comparison workspace with its own frozen dependency boundary;
2. compile Solid with its official compiler rather than the compiler-shaped fixture;
3. record local production bundle artifacts for every framework with the same bundler/minification policy;
4. add Playwright browser verification for the published benchmark protocol;
5. only then promote keyed movement into a cross-framework workload with equivalent correctness contracts.
