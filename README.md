# Rect

Rect is an experimental UI framework for modern browsers.

The premise is intentionally narrow: keep the component ergonomics that make React pleasant, discard React compatibility as a requirement, and make unnecessary work a bug. Rect is allowed to use compilation, fine-grained reactivity, and direct DOM operations without preserving legacy React semantics.

> Rect is not React-compatible and is not trying to become a drop-in replacement.

## Current slice

The current reference runtime stays deliberately small:

- `state()` creates a reactive accessor and setter.
- `derived()` creates a read-only computed accessor with automatic dependency tracking.
- `effect()` tracks the state and derived values read during each execution.
- `batch()` coalesces downstream reactive work; `untrack()` performs deliberate non-subscribing reads.
- function components execute once inside an ownership scope, and `onCleanup()` tears down component-owned work.
- `createContext()`, `provide()`, and `consume()` compose values through that ownership tree.
- `show()` owns a precise dynamic region and switches only that branch when its boolean accessor changes.
- JSX creates real DOM nodes immediately; there is no virtual DOM or component rerender loop.
- a state accessor used as a JSX child updates its text nodes directly.
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

## React compatibility boundary

Rect deliberately shares some **authoring shapes** with React, but it does not implement a React-compatible API or runtime contract.

A small presentational function component can often be moved with little source change because both systems understand JSX, function components, ordinary props, DOM attributes, and familiar event-handler props. That is source-shape similarity, not drop-in compatibility.

Stateful code is already different:

- React `useState()` returns a value plus setter and rerenders the component; Rect `state()` returns an accessor plus setter and does not rerender the component.
- React conditionals such as `{visible && <Panel />}` are revisited by rerendering; Rect uses `show(visible, () => <Panel />)` so only that owned region changes.
- React effects use hook ordering and commonly dependency arrays; Rect `effect()` discovers dependencies by reading accessors.
- React context, memoization, reconciliation, keys, synthetic events, `ReactDOM.createRoot()`, and libraries that expect React internals are not compatibility contracts of Rect.

So the practical answer is: **pure/static JSX can be close to mechanically portable; reactive React code is not drop-in source-compatible.** A compatibility adapter could be explored separately someday, but the Rect core should not acquire React's rerender and hook semantics merely to make that possible.

## Reactive composition

Rect solves the common problems associated with React hooks without adopting React's rerender-oriented hook mechanism or dependency arrays.

```tsx
import {
  batch,
  consume,
  createContext,
  derived,
  mount,
  onCleanup,
  provide,
  show,
  state,
} from "@rect/core";

const Theme = createContext("system");

function Summary() {
  const theme = consume(Theme);
  const [count, setCount] = state(0);
  const [expanded, setExpanded] = state(false);
  const doubled = derived(() => count() * 2);
  const timer = window.setInterval(() => setCount((value) => value + 1), 1_000);

  onCleanup(() => window.clearInterval(timer));

  return (
    <section data-theme={theme}>
      <button
        type="button"
        onClick={() =>
          batch(() => {
            setCount((value) => value + 1);
            setExpanded((value) => !value);
          })
        }
      >
        Doubled: {doubled}
      </button>
      {show(
        expanded,
        () => <p>Expanded details</p>,
        () => <p>Collapsed</p>,
      )}
    </section>
  );
}

function App() {
  return provide(Theme, "dark", () => <Summary />);
}

mount(<App />, document.querySelector("#app")!);
```

`provide()` and `show()` take callbacks because JSX children are currently constructed eagerly. The callbacks ensure descendants are created under the correct owner only when that scope or branch is active. The compiler may eventually make those authoring shapes terser while preserving the same ownership semantics.

## Conditional regions

`show(condition, whenTrue, whenFalse?)` tracks only the boolean condition. Each branch is lazy: the inactive branch is not constructed, and branch-internal accessor reads do not accidentally become dependencies of the region selector.

A switch creates the next branch under a dedicated child owner, disposes the previous branch and its effects/derived values/cleanups, then replaces only the nodes between two internal region anchors. There is no component rerender and no tree diff. Removing the containing component also disposes the active branch and the condition subscription.

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

For portable process measurements, use an explicit fresh output directory:

```sh
scripts/runtime-profile.sh .artifacts/runtime-profiler/state-001
```

The default `state.json` scenario stays process-only so runtime profiling remains usable on machines without native profiling permission. On a supported Linux host, the identical state-propagation workload can additionally collect bounded `perf` hotspot evidence with the opt-in scenario:

```sh
scripts/runtime-profile.sh \
  .artifacts/runtime-profiler/state-hotspots-001 \
  profiles/runtime-profiler/state-hotspots.json
```

Run `runtime-profiler detect` or `runtime-profiler plan --scenario profiles/runtime-profiler/state-hotspots.json` first when native collector availability is uncertain. If `native-perf` is unavailable, that is missing profiler evidence rather than a green hotspot result; use the process-only scenario instead of weakening the collector contract.

`runtime-profiler` captures measurements and sampled source-level evidence; it does not decide whether a change is better. Moonlight is kept as the baseline/candidate evaluator and can compare deterministic command behavior:

```sh
scripts/moonlight-compare.sh ../rect-baseline .
```

See [`docs/architecture.md`](docs/architecture.md) and [`ROADMAP.md`](ROADMAP.md).

## Status

Rect is an experiment, not a production framework. The current goal is to make each new capability small, measurable, testable, and replaceable before expanding the public surface.
