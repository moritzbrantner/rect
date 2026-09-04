# Rect

Rect is an experimental UI framework for modern browsers.

The premise is intentionally narrow: keep the component ergonomics that make React pleasant, discard React compatibility as a requirement, and make unnecessary work a bug. Rect is allowed to use compilation, fine-grained reactivity, and direct DOM operations without preserving legacy React semantics.

> Rect is not React-compatible and is not trying to become a drop-in replacement.

## Current slice

The first vertical slice is deliberately small:

- `state()` creates a reactive accessor and setter.
- `effect()` tracks the state read during each execution.
- JSX creates real DOM nodes immediately; there is no virtual DOM.
- a state accessor used as a JSX child owns one text node and updates that text node directly.
- the Counter example proves the browser path.
- a deterministic state-propagation workload establishes the first performance-evidence target.
- a Rect-built GitHub Pages performance lab exercises the browser runtime and compares bounded equivalent fixtures.

```tsx
import { mount, state } from "@rect/core";

function Counter() {
  const [count, setCount] = state(0);

  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  );
}

mount(<Counter />, document.querySelector("#app")!);
```

The component runs once. `{count}` passes the reactive accessor into the JSX runtime; the runtime subscribes the corresponding text node. A later compiler is expected to make this syntax more flexible and move more work from runtime to build time, without changing the tested behavior contract.

## Performance lab

The GitHub Pages site is itself built with Rect and keeps the benchmark surface deliberately narrower than the framework roadmap. The first browser workload measures reactive text fan-out across Rect, vanilla DOM, React + React Compiler, Preact, and Solid.

It reports dimensions separately instead of producing a synthetic winner score:

- first and warm mount latency;
- update p50/p95/p99;
- observed DOM mutations per update;
- served application/runtime JavaScript bytes when measurable;
- browser heap delta when exposed by the runtime;
- correctness verification for the first and last reactive node.

React fixture source is processed by Bun 1.4's built-in React Compiler. Framework runtimes are exact-version external browser imports in this first horizon so Rect's frozen core lockfile remains unchanged. See [`docs/performance-lab.md`](docs/performance-lab.md) for the evidence boundary and the next normalization step.

```sh
bun run dev:pages
bun run build:pages
```

## Development

Rect currently has no application-framework dependencies. Bun provides the TypeScript/JSX runtime, test runner, HTML development server, and bundler.

```sh
bash scripts/codex-environment.sh setup
bun run dev
bun run verify
```

The pinned repository environment tracks the latest-stable toolchain policy. Formatting, linting, and static type checking use exact tool versions through `bunx`; they are development tools rather than Rect runtime dependencies.

## Performance evidence

The benchmark workload validates its result and prints deterministic JSON:

```sh
bun run benchmark:smoke
bun run benchmark:state
```

For runtime measurements, use an explicit fresh output directory:

```sh
scripts/runtime-profile.sh .artifacts/runtime-profiler/state-001
```

`runtime-profiler` captures measurements; it does not decide whether a change is better. Moonlight is kept as the baseline/candidate evaluator and can compare deterministic command behavior:

```sh
scripts/moonlight-compare.sh ../rect-baseline .
```

See [`docs/architecture.md`](docs/architecture.md) and [`ROADMAP.md`](ROADMAP.md).

## Status

Rect is an experiment, not a production framework. The current goal is to make each new capability small, measurable, testable, and replaceable before expanding the public surface.
