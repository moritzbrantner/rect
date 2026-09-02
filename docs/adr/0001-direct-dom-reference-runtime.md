# ADR 0001: Start with a direct-DOM reference runtime

- Status: accepted
- Date: 2026-09-02

## Context

Rect is intended to explore a modern React-shaped authoring model without preserving React compatibility. A compiler-oriented framework can easily hide an unclear execution model behind transforms and benchmarks.

The first implementation needs an executable semantic baseline that is simple enough to inspect and use as a differential oracle when compilation arrives.

## Decision

The initial Rect implementation:

- has no virtual DOM;
- creates browser DOM nodes directly from JSX runtime calls;
- represents state as tracked accessors;
- updates dynamic text through fine-grained effects;
- does not rerun a component as the default state-update mechanism;
- keeps compiler work out of Stage 0.

The future compiler is expected to specialize this behavior rather than introduce a second unrelated model.

## Consequences

Positive:

- the Counter establishes useful behavior with very little machinery;
- compiler output can be differential-tested against a reference implementation;
- performance work starts from known operations rather than framework folklore;
- Rect does not inherit React reconciliation semantics accidentally.

Costs:

- Stage 0 syntax is intentionally limited: reactive JSX text uses the accessor itself (`{count}`);
- dynamic branches and collections need explicit ownership before they can be added safely;
- compiler ergonomics are deferred rather than simulated in the runtime.
