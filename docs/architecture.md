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

A component that produces a `DocumentFragment` carries its owner disposer with that fragment. When the fragment is inserted, the disposer is transferred to the first concrete child, or to the receiving parent for an empty result. This avoids adding marker DOM solely for ordinary component lifetime bookkeeping.

## Conditional regions

`show(condition, whenTrue, whenFalse?)` is Rect's first explicit dynamic DOM region. It uses two stable comment anchors around the currently active branch rather than rerendering the surrounding component or diffing a tree.

The region owns one selector effect. That effect reads only the boolean condition. Branch construction runs through `untrack()`, so an incidental accessor read while creating a branch cannot silently widen the selector's dependencies.

Each selected branch gets a dedicated child owner whose parent is the owner that created the region. This matters when a later switch occurs after the original component/provider callback has returned: context lookup still walks through the captured owner tree, and branch-created effects, derived values, child components, providers, and `onCleanup()` handlers receive the correct lifetime.

A branch switch is deliberately narrow:

1. construct the next branch lazily under a fresh branch owner;
2. dispose every node and owner belonging to the previous branch;
3. insert the new branch immediately before the stable end anchor;
4. leave surrounding DOM and component execution untouched.

If the containing component is unmounted, the start-anchor disposer stops the selector and disposes the active branch. Shared dynamic-text bindings remain node-owned, so removing the last text node in an inactive branch tears down that fan-out binding without coupling it to the branch owner.

Keyed collections should reuse the same owner-tree model but define their own item/key algorithm rather than generalizing `show()` into a hidden reconciler.

## Context

`createContext()`, `provide()`, and `consume()` use the owner tree rather than a global stack. A provider creates a child owner carrying the context value, and descendants resolve the nearest matching value.

JSX children are currently constructed eagerly, so `provide()` intentionally accepts a callback:

```tsx
return provide(Theme, "dark", () => <Toolbar />);
```

The callback ensures descendant components execute while the provider owner is active. `show()` uses the same lazy-callback rule for branches. A future compiler may provide friendlier syntax without changing the ownership semantics.

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
- `show`;
- `mount` and `Fragment`;
- supporting TypeScript types.

Names and signatures may still change. The package stays private at `0.0.0` until the semantics survive the compiler and control-flow stages.

## React compatibility boundary

Rect is not a React runtime implementation. JSX syntax, function-component shape, ordinary props, and many DOM event/attribute spellings are intentionally familiar, so small presentational components may be mechanically portable. Stateful semantics are different: Rect components execute once, state is read through accessors, effects discover dependencies automatically, and dynamic branches use explicit regions instead of relying on component rerenders. React packages that depend on React hooks, reconciliation, context internals, synthetic events, `ReactDOM`, or key semantics are therefore outside Rect's compatibility contract.

## Performance architecture

The deterministic workload in `benchmarks/state.ts` does not measure its own time. It validates state propagation and prints bounded JSON. This makes it useful as a stable command target.

`runtime-profiler` owns process measurement and immutable evidence bundles. Moonlight owns evaluation. Rect code should not parse either tool's private artifacts or duplicate their policies.
