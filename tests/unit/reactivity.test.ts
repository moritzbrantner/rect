import { describe, expect, test } from "bun:test";

import {
  batch,
  consume,
  createContext,
  createOwner,
  derived,
  disposeOwner,
  effect,
  onCleanup,
  provide,
  runWithOwner,
  state,
  untrack,
} from "../../src/reactivity.ts";

describe("state", () => {
  test("notifies only when the value changes", () => {
    const [count, setCount] = state(0);
    const seen: number[] = [];
    const dispose = effect(() => {
      seen.push(count());
    });

    setCount(1);
    setCount(1);
    setCount((value) => value + 1);

    expect(seen).toEqual([0, 1, 2]);

    dispose();
    setCount(3);
    expect(seen).toEqual([0, 1, 2]);
  });

  test("retracks dependencies on every execution", () => {
    const [enabled, setEnabled] = state(true);
    const [left, setLeft] = state(1);
    const [right, setRight] = state(10);
    const seen: number[] = [];

    effect(() => {
      seen.push(enabled() ? left() : right());
    });

    setLeft(2);
    setEnabled(false);
    setLeft(3);
    setRight(11);

    expect(seen).toEqual([1, 2, 10, 11]);
  });

  test("restores the outer dependency context after a nested effect runs", () => {
    const [outer, setOuter] = state(0);
    const [inner, setInner] = state(0);
    const [tail, setTail] = state(0);
    const seen: string[] = [];
    let disposeInner: (() => void) | undefined;

    const disposeOuter = effect(() => {
      const outerValue = outer();
      disposeInner ??= effect(() => {
        seen.push(`inner:${inner()}`);
      });
      seen.push(`outer:${outerValue}:${tail()}`);
    });

    setTail(1);
    setInner(1);
    setOuter(1);

    expect(seen).toEqual(["inner:0", "outer:0:0", "outer:0:1", "inner:1", "outer:1:1"]);

    disposeOuter();
    disposeInner?.();
    setTail(2);
    setInner(2);
    expect(seen.at(-1)).toBe("outer:1:1");
  });

  test("uses Object.is semantics for change detection", () => {
    const [value, setValue] = state<number>(Number.NaN);
    let executions = 0;
    effect(() => {
      value();
      executions += 1;
    });

    setValue(Number.NaN);
    expect(executions).toBe(1);

    setValue(0);
    setValue(-0);
    expect(executions).toBe(3);
  });
});

describe("derived", () => {
  test("retracks branch-dependent inputs and ignores unrelated state", () => {
    const [enabled, setEnabled] = state(true);
    const [left, setLeft] = state(1);
    const [right, setRight] = state(10);
    let computations = 0;
    const selected = derived(() => {
      computations += 1;
      return enabled() ? left() : right();
    });

    expect(selected()).toBe(1);
    expect(computations).toBe(1);

    setRight(11);
    expect(computations).toBe(1);

    setLeft(2);
    expect(selected()).toBe(2);
    expect(computations).toBe(2);

    setEnabled(false);
    expect(selected()).toBe(11);
    expect(computations).toBe(3);

    setLeft(3);
    expect(computations).toBe(3);

    setRight(12);
    expect(selected()).toBe(12);
    expect(computations).toBe(4);
  });

  test("notifies consumers only when its derived value changes", () => {
    const [value, setValue] = state(0);
    const parity = derived(() => value() % 2);
    const seen: number[] = [];
    effect(() => {
      seen.push(parity());
    });

    setValue(2);
    setValue(3);

    expect(seen).toEqual([0, 1]);
  });

  test("stops owned tracking after owner disposal", () => {
    const [value, setValue] = state(1);
    const owner = createOwner(undefined);
    let computations = 0;
    const doubled = runWithOwner(owner, () =>
      derived(() => {
        computations += 1;
        return value() * 2;
      }),
    );

    expect(doubled()).toBe(2);
    setValue(2);
    expect(doubled()).toBe(4);
    expect(computations).toBe(2);

    disposeOwner(owner);
    setValue(3);
    expect(doubled()).toBe(4);
    expect(computations).toBe(2);
  });
});

describe("reactive composition", () => {
  test("batches multiple writes into one downstream execution", () => {
    const [left, setLeft] = state(0);
    const [right, setRight] = state(0);
    const seen: string[] = [];
    effect(() => {
      seen.push(`${left()}:${right()}`);
    });

    batch(() => {
      setLeft(1);
      setRight(2);
    });

    expect(seen).toEqual(["0:0", "1:2"]);
  });

  test("deduplicates overlapping raw and derived dependencies", () => {
    const [count, setCount] = state(0);
    const doubled = derived(() => count() * 2);
    const seen: string[] = [];
    effect(() => {
      seen.push(`${count()}:${doubled()}`);
    });

    batch(() => {
      setCount(1);
      setCount(2);
    });

    expect(seen).toEqual(["0:0", "2:4"]);
  });

  test("untrack reads state without subscribing the active effect", () => {
    const [tracked, setTracked] = state(0);
    const [ignored, setIgnored] = state(0);
    let executions = 0;
    effect(() => {
      tracked();
      untrack(() => ignored());
      executions += 1;
    });

    setIgnored(1);
    expect(executions).toBe(1);

    setTracked(1);
    expect(executions).toBe(2);
  });

  test("owner disposal tears down effects and registered cleanup exactly once", () => {
    const [count, setCount] = state(0);
    const owner = createOwner(undefined);
    let executions = 0;
    let cleanups = 0;

    runWithOwner(owner, () => {
      effect(() => {
        count();
        executions += 1;
      });
      onCleanup(() => {
        cleanups += 1;
      });
    });

    setCount(1);
    expect(executions).toBe(2);

    disposeOwner(owner);
    setCount(2);
    expect(executions).toBe(2);
    expect(cleanups).toBe(1);

    disposeOwner(owner);
    expect(cleanups).toBe(1);
  });

  test("context is inherited through owned scopes and falls back outside the provider", () => {
    const theme = createContext("system");
    const owner = createOwner(undefined);
    let providerCleanups = 0;

    const value = runWithOwner(owner, () =>
      provide(theme, "dark", () => {
        onCleanup(() => {
          providerCleanups += 1;
        });
        const child = createOwner();
        return runWithOwner(child, () => consume(theme));
      }),
    );

    expect(value).toBe("dark");
    expect(runWithOwner(owner, () => consume(theme))).toBe("system");

    disposeOwner(owner);
    expect(providerCleanups).toBe(1);
    expect(consume(theme)).toBe("system");
  });

  test("requires ownership for cleanup and providers without defaults", () => {
    const required = createContext<string>();

    expect(() => consume(required)).toThrow("could not find");
    expect(() => onCleanup(() => undefined)).toThrow("owned component subtree");
    expect(() => provide(required, "value", () => "child")).toThrow("owned component subtree");
  });
});
