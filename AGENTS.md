# AGENTS.md

## Mission

Rect is an experimental modern UI framework. Optimize for a small understandable execution model, measurable work, and modern-browser behavior. Do not preserve React compatibility merely because an API exists in React.

## Non-goals

- React API, hook, reconciliation, or legacy compatibility.
- a general virtual DOM.
- class components, synthetic events, dependency arrays, manual memoization APIs, or compatibility shims.
- performance claims based only on a flattering microbenchmark.
- adding framework/tooling dependencies before a concrete capability needs them.

## Current execution model

- Components are ordinary functions that execute once when JSX constructs them.
- Each function component executes inside an owner scope; owned effects, derived tracking, child owners, and `onCleanup()` teardown end with that component lifetime.
- JSX creates real DOM nodes.
- `state()` returns a tracked accessor plus setter; `derived()` returns a read-only tracked accessor.
- `effect()` retracks dependencies on every execution; `batch()` deduplicates downstream execution and `untrack()` suppresses deliberate incidental dependency collection.
- A reactive accessor used directly as a JSX child represents dynamic text. Repeated uses of the same accessor share the fan-out tracking work while retaining direct text-node writes.
- `createContext()` / `provide()` / `consume()` resolve values through the owner tree. `provide()` uses a callback because JSX children are currently eager.
- `show()` owns a condition-driven DOM region between stable anchors. Branch callbacks are lazy, branch construction is untracked by the selector, and each active branch has its own owner lifetime.
- There are no component rerenders, dependency arrays, manual memoization hooks, or a virtual DOM.
- The compiler is intentionally deferred until the reference runtime semantics have tests and evidence.

Preserve these semantics unless a PR explicitly changes the architecture contract.

## Validation

Use the cheapest useful gate first:

```sh
bun run test:unit
bun run typecheck
bun run lint
bun run build
bun run verify
```

Performance work is opt-in:

```sh
bun run benchmark:smoke
scripts/runtime-profile.sh <fresh-output-directory>
```

Do not overwrite an existing runtime-profiler bundle. Preserve the scenario, source revision, command output, and environment evidence when investigating a regression.

## Landscape boundaries

- `coding-agent-conventions` owns shared engineering policy. Rect-specific framework rules stay here or in Rect docs.
- `coding-tooling` discovers and runs deterministic semantic capabilities.
- `runtime-profiler` captures runtime evidence.
- Moonlight evaluates compatible baseline/candidate evidence or command behavior.
- Renovate policy is inherited from `coding-agent-conventions`.
- environment setup is declared by `.repository-environment.toml` and `scripts/codex-environment.sh`.

Do not make Rect runtime code depend on those agent-landscape components.

## Architectural bias

Prefer, in order:

1. static work at compile/build time;
2. targeted reactive updates;
3. tiny explicit runtime primitives;
4. generic runtime machinery only when a real case requires it.

A compiler optimization must preserve a small non-compiler reference behavior so differential tests can prove it. New control-flow machinery should arrive with ownership tests before benchmark claims.

## Next decision horizon

The next work should stay within the issues described in `ROADMAP.md`: compiler-assisted static JSX, keyed collections, and progressively more precise region ownership. Do not turn `show()` into a generic reconciler and do not pre-design routing, server components, legacy compatibility, or a broad ecosystem.
