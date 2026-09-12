# Rect comparison workspace

This private workspace owns dependencies used only by the performance-lab comparison fixtures.

The root repository lockfile freezes the exact versions declared here, but these packages are not dependencies of `@rect/core`. Framework-owned fixture sources live beside this package so Bun resolves and bundles them through this workspace boundary.

`bun run build:pages` builds every fixture with the shared contract in `contract.ts` and emits `dist/pages/fixtures/manifest.json`. `bun run verify:comparison` checks that the emitted assets are self-contained and that their recorded byte sizes match the build output.

This workspace is benchmark infrastructure, not Rect runtime API or implementation code. Its presence does not justify a framework winner or speedup claim.
