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

- Components are ordinary functions that execute when JSX constructs them.
- JSX creates real DOM nodes.
- `state()` returns a tracked accessor plus setter.
- A reactive accessor used directly as a JSX child currently represents dynamic text.
- `effect()` retracks dependencies on every execution.
- The compiler is intentionally deferred until the runtime semantics have tests and evidence.

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

A compiler optimization must preserve a small non-compiler reference behavior so differential tests can prove it. New control-flow machinery should arrive with parity tests before benchmark claims.

## Next decision horizon

The next work should stay within the issues described in `ROADMAP.md`: compiler-assisted static JSX, derived values, conditional regions, and keyed collections. Do not pre-design routing, server components, legacy compatibility, or a broad ecosystem.
