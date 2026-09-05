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

Comparison-only framework runtimes stay outside Rect's core dependency graph. The first Pages horizon may use exact-version browser imports; a later comparison-workspace slice should normalize all framework builds under its own frozen dependency boundary before bundle-size claims become release evidence.

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

Implement one primitive at a time:

1. conditional regions;
2. keyed collections;
3. region-specific ownership/disposal for independently removed fragments.

The base component owner tree already exists. Control-flow work must make ownership more precise rather than introducing a second lifetime model.

For keyed collections, make the algorithm explicit and benchmark adversarial cases rather than hiding a generic tree diff behind JSX.

## Stage 4 — normalized comparison harness

Promote the browser comparison from exploratory evidence to a reproducible local harness with equivalent small fixtures for:

- Rect reference runtime;
- Rect compiled output;
- vanilla DOM;
- current React + React Compiler;
- Preact;
- Solid.

Separate correctness parity, bundle size, startup, memory, allocation behavior, and update latency. Avoid a single synthetic “X times faster” score.

## Deferred

Routing, SSR/hydration, streaming, async resources, server components, devtools, forms, animation, custom renderers, and broad browser compatibility are deliberately outside the current decision horizon.
