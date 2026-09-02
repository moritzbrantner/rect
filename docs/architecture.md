# Architecture

## Principle

Rect should do work proportional to the change whenever the dependency is knowable.

The project starts with the simplest executable semantics and progressively moves work out of the runtime. A compiler is a destination, not an excuse to invent an opaque runtime before the behavior is understood.

## Stage 0

```text
TSX
 │
 │ automatic JSX transform
 ▼
Rect JSX runtime ───────► real DOM nodes
                              ▲
                              │ targeted updates
state accessor ─► effect ─────┘
```

There is no virtual DOM and no component rerender loop.

For the Counter, JSX passes the `count` accessor itself as a child. The runtime recognizes a Rect accessor, creates one `Text` node, and tracks that accessor inside an effect. Updating `count` executes only that subscriber and mutates the text node.

## Ownership

The v0 DOM runtime associates reactive disposers with nodes it creates. `mount()` disposes the current mounted subtree before replacement and returns a disposer for the mounted root.

This is deliberately sufficient only for the current static-tree slice. Conditional and keyed regions must introduce explicit ownership so removed subtrees cannot retain reactive subscriptions.

## Compiler direction

The compiler should eventually understand enough of a component to specialize:

- static element creation;
- dynamic text/property writes;
- branches;
- keyed collections;
- derived expressions.

The generated program should favor direct operations over generic tree reconciliation.

The reference runtime remains valuable after compilation exists:

```text
source fixture
   ├── reference runtime ──► observable behavior
   └── Rect compiler ──────► observable behavior
                              │
                              └── differential parity
```

Performance evaluation only follows parity.

## Public surface discipline

Stage 0 intentionally exposes only:

- `state`;
- `effect`;
- `mount`;
- `Fragment`;
- supporting TypeScript types.

Names and signatures may still change. The package stays private at `0.0.0` until the semantics survive the next compiler/control-flow stages.

## Performance architecture

The deterministic workload in `benchmarks/state.ts` does not measure its own time. It validates state propagation and prints bounded JSON. This makes it useful as a stable command target.

`runtime-profiler` owns process measurement and immutable evidence bundles. Moonlight owns evaluation. Rect code should not parse either tool's private artifacts or duplicate their policies.
