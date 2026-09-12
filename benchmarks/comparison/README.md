# Rect comparison workspace

This private workspace owns dependencies used only by the performance-lab comparison fixtures and their browser acceptance tooling.

The root repository lockfile freezes the exact versions declared here, but these packages are not dependencies of `@rect/core`. Framework-owned fixture sources live beside this package so Bun resolves and bundles them through this workspace boundary. Playwright is pinned here as test tooling only; the Pages gate installs its matching Chromium build before browser acceptance.

`bun run build:pages` builds every fixture with the shared contract in `contract.ts` and emits `dist/pages/fixtures/manifest.json`. `bun run verify:comparison` checks that the emitted assets are self-contained and that their recorded byte sizes match the build output.

`bun run verify:comparison:browser` serves those built Pages artifacts locally and drives the published fan-out and Rect-keyed protocols in Chromium. It verifies correctness-gated results, manifest/served byte agreement, pinned framework versions, expected fixture loading, and the absence of unexpected external runtime requests. It validates evidence shape and protocol behavior only; it does not impose latency thresholds.

This workspace is benchmark infrastructure, not Rect runtime API or implementation code. Its presence does not justify a framework winner or speedup claim.
