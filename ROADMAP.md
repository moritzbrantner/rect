# Rect roadmap

The roadmap is intentionally bounded. Each stage should leave behind a runnable example, tests, and evidence before the next abstraction is introduced.

## Stage 0 — direct DOM counter

Current bootstrap:

- reactive `state()` and `effect()`;
- automatic JSX runtime that creates real DOM;
- direct reactive text updates;
- Counter browser example;
- deterministic state-propagation workload;
- coding-tooling, environment-v1, Renovate, runtime-profiler, and Moonlight seams.

Exit condition: the Counter builds, state semantics have tests, and the benchmark command is reproducible.

## Stage 0.5 — browser performance lab

Expose the existing behavior contract through a Rect-built GitHub Pages site without widening the runtime API.

First horizon:

- interactive Rect counter that dogfoods the framework;
- isolated reactive text fan-out fixture;
- Rect, vanilla DOM, React + React Compiler, Preact, and Solid comparisons;
- p50/p95/p99 latency evidence rather than a single score;
- observable DOM mutation, JavaScript transfer, heap, and correctness evidence where the browser exposes it;
- an explicit methodology/limitations document.

Comparison-only framework runtimes stay outside Rect's core dependency graph. Stage 4 owns their frozen workspace/build boundary so the Pages surface can stay useful without making those runtimes part of Rect itself.

Exit condition: Pages builds in CI, the browser protocol verifies fixture correctness, and no Rect runtime change exists solely to improve the benchmark.

## Stage 1 — compiler-assisted static JSX

Introduce the first Rect compiler transform, preferably on Oxc/Rust infrastructure if the integration remains small enough.

The first transform should be intentionally boring:

- identify static DOM structure;
- identify dynamic text expressions;
- emit direct creation/update operations;
- preserve the Stage 0 runtime as a reference oracle;
- differential-test compiled and reference behavior;
- capture bundle/startup/update evidence before claiming an improvement.

Do not add a general virtual DOM as an intermediate representation.

## Stage 2 — reactive composition and ownership

The reference runtime now owns the first hooks-equivalent composition slice without adopting React hook semantics:

- `derived()` for read-only computed accessors with automatic dependency retracking;
- component owner scopes that recursively dispose owned effects and derived tracking;
- `onCleanup()` for external lifetime teardown;
- `batch()` for deduplicated downstream propagation;
- `untrack()` for deliberate non-subscribing reads;
- owner-tree context via `createContext()`, `provide()`, and `consume()`.

Required properties:

- deterministic dependency tracking;
- no dependency arrays;
- no manual memoization API;
- no component rerender loop;
- clear disposal/ownership rules;
- context lifetime follows ownership rather than a global mutable stack.

The compiler may later specialize derived expressions and provider syntax, but the reference behavior remains the differential oracle.

Exit condition: branch-dependent derived values, batching, non-tracked reads, owner disposal, cleanup, and context inheritance have deterministic tests; mounted component teardown releases owned subscriptions.

## Stage 3 — control flow

Control flow is introduced one region primitive at a time.

### 3.1 Conditional regions

`show(condition, whenTrue, whenFalse?)` is the first explicit dynamic region:

- only the boolean condition is tracked by the region selector;
- branches are lazy callbacks rather than eagerly constructed JSX;
- each active branch receives a dedicated owner lifetime;
- switching disposes the old branch immediately and inserts only the selected branch between stable DOM anchors;
- branch-local effects, derived values, context, cleanup, and dynamic text stay within their existing ownership rules;
- no component rerender or generic tree diff is introduced.

Exit condition: repeated switching, branch cleanup, context inheritance, incidental non-tracked branch reads, shared dynamic text, and containing-tree disposal have deterministic coverage.

### 3.2 Keyed collections

Next, add a keyed collection region with an explicit algorithm and stable item owners. Benchmark append, prepend, reorder, sparse removal, and adversarial key movement instead of hiding a generic tree diff behind JSX.

### 3.3 Region ownership refinement

Control-flow regions now tighten ownership only where conditional and keyed removal made the first-child lifetime shortcut ambiguous:

- empty and multi-node components use one trailing internal lifetime anchor so nested region/node cleanup happens before the containing component owner ends;
- conditional branches detach their complete active fragment before node and branch-owner teardown;
- keyed items use explicit region-managed `ReactiveOwner` instances rather than an anonymous component owner attached to the first rendered node;
- keyed item removal clears the complete detached range before item-owner cleanup while retained keys keep the same owner and DOM identity;
- region-managed owners retain the ordinary context parent chain and the existing owner/effect/cleanup semantics; no second lifetime system is introduced.

Exit condition: nested conditional cleanup and keyed multi-node cleanup are deterministic on both independent removal and containing-tree teardown, and late-created keyed items still inherit provider context.

## Stage 4 — normalized comparison harness

Promote the browser comparison from exploratory evidence to a reproducible local harness with equivalent small fixtures for:

- Rect reference runtime;
- Rect compiled output once Stage 1 exists;
- vanilla DOM;
- current React + React Compiler;
- Preact;
- Solid.

Separate correctness parity, bundle size, startup, memory, allocation behavior, and update latency. Avoid a single synthetic “X times faster” score.

### 4.1 Frozen local fixture boundary

The first normalization slice owns dependency and build reproducibility without changing workload semantics:

- comparison-only React, React DOM, Preact, and Solid packages live in a dedicated private workspace with exact versions;
- the repository lockfile freezes that workspace while `@rect/core` remains dependency-free from those frameworks;
- every fixture uses Bun 1.4 with the same browser target, ESM format, minification, and bundled-package policy;
- the browser runner no longer resolves comparison runtimes through a CDN/import map;
- the Pages build emits a manifest with source revision, tool/build settings, exact package versions, fixture assets, and byte counts;
- verification fails closed if external runtime imports return or manifest byte evidence drifts from the emitted artifacts.

Exit condition: authoritative validation and Pages build pass from the frozen boundary, and the emitted comparison assets are self-contained.

### 4.2 Compiler and protocol normalization

The published protocol now has its first real-browser acceptance slice:

- Playwright is pinned as comparison-only tooling and drives its matching Chromium build;
- acceptance serves the built `dist/pages` output rather than a development source server;
- the five-framework fan-out protocol runs with one bounded smoke configuration and every result must pass its existing correctness gate;
- browser-visible manifest data and served asset bytes must match the build evidence;
- React, Preact, and Solid must report the exact versions frozen by the comparison workspace;
- the Rect-only keyed protocol must execute all five movement classes with its existing correctness contract;
- unexpected external HTTP(S) runtime requests, page errors, or console errors fail closed;
- no latency budget, winner score, or Rect runtime change is introduced by browser acceptance.

Exit condition for the browser-acceptance slice: authoritative validation, Pages boundary verification, and the Chromium published-protocol check all pass from the same PR head.

Remaining normalization work before stronger comparison claims:

- compile Solid with its official compiler instead of the current compiler-shaped direct-DOM fixture;
- add equivalent batched/multi-value workloads rather than inferring scheduler behavior from one shared-text update;
- add the Rect compiled fixture after Stage 1 exists;
- promote keyed movement only after every compared runtime has an equivalent keyed correctness contract.

## Deferred

Routing, SSR/hydration, streaming, async resources, server components, devtools, forms, animation, custom renderers, and broad browser compatibility are deliberately outside the current decision horizon.
