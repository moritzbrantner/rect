# Browser performance lab

The GitHub Pages performance lab is an evidence surface for Rect, not a leaderboard.

## Horizon 1 workload

The initial benchmark owns one workload only: reactive text fan-out.

1. Mount `N` text cells at value `0`.
2. Verify the first and last cell.
3. Warm the update path.
4. Update one shared value repeatedly.
5. Verify the final first and last cell.
6. Record mount and update distributions plus observable browser evidence.

This workload is useful because Rect v0 has an explicit semantic contract for exactly this operation. Keyed collections, conditional regions, hydration, and other features do not enter the comparison until Rect owns and tests those semantics.

## Fixtures

- **Rect** uses the reference runtime with one tracked text node per cell. No Rect compiler exists yet.
- **Vanilla DOM** is the low-level imperative reference.
- **React 19.2.8** is built with Bun 1.4's built-in React Compiler and measured with synchronous `flushSync` updates.
- **Preact 10.29.8** uses the real renderer with its debounce scheduler made synchronous for the measurement boundary.
- **Solid 1.9.15** uses Solid-owned signals/render lifetime and direct DOM effects in the same fine-grained shape its compiler targets. It is intentionally described as compiler-shaped rather than claiming an official Solid compiler pass.

Framework runtime imports are exact-version browser ESM imports in Horizon 1. This avoids adding comparison-only packages to Rect's frozen runtime/tooling lockfile.

## Measurements

The page keeps dimensions independent:

- first mount latency;
- warm mount p50/p95/p99;
- update p50/p95/p99;
- mutation-observer records per update;
- fixture application bundle bytes;
- cross-origin runtime transfer bytes when Resource Timing exposes them;
- JavaScript heap delta when the browser exposes `performance.memory`.

A missing browser metric is reported as unavailable rather than replaced by an estimate.

## Interpretation boundary

The browser page is exploratory performance evidence. Network cache state, hardware, browser version, background work, thermal state, JIT state, and extension activity can all move measurements. Do not turn a Pages run into a universal "X times faster" claim.

The deterministic `benchmarks/` workload, runtime-profiler capture, and Moonlight baseline/candidate evaluation remain the source-development evidence path.

## Next horizon

Normalize the comparison harness without touching Rect runtime semantics:

1. add a dedicated comparison workspace with its own frozen dependency boundary;
2. compile Solid with its official compiler rather than the compiler-shaped fixture;
3. record local production bundle artifacts for every framework with the same bundler/minification policy;
4. add Playwright browser verification for the published benchmark protocol;
5. only then introduce a second workload whose Rect semantics already exist and are tested.
