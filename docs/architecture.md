# Architecture

## Principle

Rect should do work proportional to the change whenever the dependency is knowable.

The project starts with the simplest executable semantics and progressively moves work out of the runtime. A compiler is a destination, not an excuse to invent an opaque runtime before the behavior is understood.

## Reference runtime

```text
TSX
 │
 │ automatic JSX transform
 ▼
Rect JSX runtime ───────► real DOM nodes
                              ▲
                              │ targeted updates
state accessor ─► effect ─────┘
       │
       └────────► derived accessor
```

There is no virtual DOM and no component rerender loop.

For the Counter, JSX passes the `count` accessor itself as a child. The runtime recognizes a Rect accessor, creates one `Text` node, and tracks that accessor inside an effect. Repeated uses of the same accessor share one text fan-out binding, so one reactive read and text conversion can drive multiple direct `Text.data` writes.

## Reactive composition

`state()` is the mutable source primitive. `derived()` creates a read-only accessor whose dependencies are tracked and retracked automatically; consumers are notified only when the derived value changes according to `Object.is`.

`effect()` tracks dependencies on every execution. `untrack()` temporarily suppresses dependency collection for deliberate incidental reads. `batch()` delays downstream effect execution until the outermost batch completes and deduplicates repeated invalidations of the same effect.

Rect does not use dependency arrays, component rerenders, `useMemo`, or `useCallback`. The reference model keeps dependency discovery in accessors and moves static work toward the compiler instead.

## Ownership and cleanup

Every function component executes once inside a reactive owner scope. Owners form a parent/child tree that is separate from dependency tracking:

- effects created while a component executes register with that component owner;
- `derived()` inherits the same lifetime through its internal tracking effect;
- `onCleanup()` registers arbitrary teardown such as timers, subscriptions, or external listeners;
- disposing an owner recursively disposes child owners and owned effects before releasing the owner;
- component owners are associated with the DOM result so `mount()` replacement/unmount tears down the corresponding reactive lifetime.

The shared dynamic-text fan-out binding is deliberately node-owned rather than component-owned because one accessor may be rendered by nodes belonging to different component owners. Its effect lives until its last bound text node is disposed.

A component that produces a `DocumentFragment` carries its owner disposer with that fragment. When the fragment is inserted, the disposer is transferred to the first concrete child, or to the receiving parent for an empty result. This avoids adding marker DOM solely for lifetime bookkeeping in the current static-tree slice.

Conditional and keyed regions will need more precise region ownership so independently removed fragments dispose immediately rather than relying on their containing static owner.

## Context

`createContext()`, `provide()`, and `consume()` use the owner tree rather than a global stack. A provider creates a child owner carrying the context value, and descendants resolve the nearest matching value.

JSX children are currently constructed eagerly, so `provide()` intentionally accepts a callback:

```tsx
return provide(Theme, "dark", () => <Toolbar />);
```

The callback ensures descendant components execute while the provider owner is active. A future compiler may provide friendlier syntax without changing the ownership semantics.

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

The current private `0.0.0` surface exposes:

- `state` and `derived`;
- `effect`, `batch`, and `untrack`;
- `onCleanup`;
- `createContext`, `provide`, and `consume`;
- `mount` and `Fragment`;
- supporting TypeScript types.

Names and signatures may still change. The package stays private at `0.0.0` until the semantics survive the compiler and control-flow stages.

## Performance architecture

The deterministic workload in `benchmarks/state.ts` does not measure its own time. It validates state propagation and prints bounded JSON. This makes it useful as a stable command target.

`runtime-profiler` owns process measurement and immutable evidence bundles. Moonlight owns evaluation. Rect code should not parse either tool's private artifacts or duplicate their policies.
