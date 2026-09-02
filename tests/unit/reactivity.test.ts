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
});
