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

## Stage 2 — derived values and effects

Add an explicit `derived()` primitive or prove that compiler-derived expressions can cover the useful cases.

Required properties:

- deterministic dependency tracking;
- no dependency arrays;
- no manual memoization API;
- clear disposal/ownership rules.

## Stage 3 — control flow

Implement one primitive at a time:

1. conditional regions;
2. keyed collections;
3. nested ownership/disposal.

For keyed collections, make the algorithm explicit and benchmark adversarial cases rather than hiding a generic tree diff behind JSX.

## Stage 4 — comparison harness

Build equivalent small fixtures for:

- Rect reference runtime;
- Rect compiled output;
- vanilla DOM;
- current React + React Compiler;
- Preact;
- Solid.

Separate correctness parity, bundle size, startup, memory, allocation behavior, and update latency. Avoid a single synthetic “X times faster” score.

## Deferred

Routing, SSR/hydration, streaming, async resources, server components, devtools, forms, animation, custom renderers, and broad browser compatibility are deliberately outside the current decision horizon.
