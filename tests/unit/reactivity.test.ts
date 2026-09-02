import { describe, expect, test } from "bun:test";

import { effect, state } from "../../src/reactivity.ts";

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
