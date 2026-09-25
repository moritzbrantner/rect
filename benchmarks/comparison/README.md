# Rect comparison workspace

This private workspace owns dependencies used only by the performance-lab comparison fixtures and their browser acceptance tooling.

The root repository lockfile freezes the exact versions declared here, but these packages are not dependencies of `@rect/core`. Framework-owned fixture sources live beside this package so Bun resolves and bundles them through this workspace boundary. Compiler tooling is pinned here as development-only benchmark infrastructure: the Solid fixture is authored as JSX and transformed through the matching official `babel-preset-solid` DOM compiler before Bun bundles it. Playwright is pinned here as test tooling only; the Pages gate installs its matching Chromium build before browser acceptance.

`bun run build:pages` builds every fixture with the shared contract in `contract.ts` and emits `dist/pages/fixtures/manifest.json`. The manifest records both runtime package versions and comparison-only compiler versions. `bun run verify:comparison` checks that the emitted assets are self-contained, that their recorded byte sizes match the build output, and that the Solid fixture records the expected compiler contract.

`bun run verify:comparison:browser` serves those built Pages artifacts locally and drives the published shared fan-out, batched multi-value, and Rect-keyed protocols in Chromium. The batched protocol gives every framework independently owned values and correctness-checks one synchronous logical transaction that changes them all; latency and MutationObserver passes remain separate. Browser acceptance also verifies manifest/served byte agreement, pinned framework versions, expected fixture loading, and the absence of unexpected external runtime requests. It validates evidence shape and protocol behavior only; it does not impose latency thresholds.

This workspace is benchmark infrastructure, not Rect runtime API or implementation code. Its presence does not justify a framework winner or speedup claim.
