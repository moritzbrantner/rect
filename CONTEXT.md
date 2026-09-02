# Rect context

## Thesis

Rect explores a React-shaped authoring experience without React's compatibility contract. Its target execution model is compiler-assisted direct DOM updates with fine-grained dependency tracking.

## Vocabulary

**Component** — an authoring boundary expressed as a function. Component execution is not itself the update mechanism.

**Accessor** — a zero-argument function returned by `state()` that records a dependency when read inside an effect.

**Dynamic child** — in v0, an accessor passed directly as a JSX child. It owns a text node whose value is updated by an effect.

**Reference runtime** — the simple direct-DOM implementation under `src/`. As compiler stages arrive, this remains useful as an executable behavior oracle.

**Compiler** — future build-time analysis that should specialize static structure, reactive expressions, branches, and collections. Compilation is expected to become central to Rect, but it should optimize semantics that already have tests.

**Performance evidence** — reproducible measurements captured separately from correctness. Deterministic benchmark commands validate their output; `runtime-profiler` captures process evidence; Moonlight owns baseline/candidate evaluation.

## Important distinction from React

Calling a Rect component does not imply that future state changes rerun that component and diff a new tree. State should update the smallest known dependent region.

This distinction is the core experiment.
