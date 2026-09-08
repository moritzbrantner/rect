import { expect, test } from "bun:test";

import {
  applyKeyedScenario,
  createKeyedItems,
} from "../../examples/performance-lab/keyed-workload.ts";

function ids(items: readonly { id: number }[]): number[] {
  return items.map((item) => item.id);
}

test("keyed browser workloads cover the five roadmap movement classes", () => {
  const baseline = createKeyedItems(8);

  expect(ids(applyKeyedScenario(baseline, "append", 2))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 10]);
  expect(ids(applyKeyedScenario(baseline, "prepend", 2))).toEqual([-3, 0, 1, 2, 3, 4, 5, 6, 7]);
  expect(ids(applyKeyedScenario(baseline, "reorder", 0))).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
  expect(ids(applyKeyedScenario(baseline, "sparse-removal", 0))).toEqual([0, 1, 2, 4, 5, 6]);
  expect(ids(applyKeyedScenario(baseline, "adversarial-movement", 0))).toEqual([
    7, 6, 5, 4, 3, 2, 1, 0,
  ]);

  expect(ids(baseline)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});

test("keyed append and prepend keys remain outside the retained baseline key space", () => {
  const baseline = createKeyedItems(4);

  expect(ids(applyKeyedScenario(baseline, "append", 0))).toEqual([0, 1, 2, 3, 4]);
  expect(ids(applyKeyedScenario(baseline, "append", 7))).toEqual([0, 1, 2, 3, 11]);
  expect(ids(applyKeyedScenario(baseline, "prepend", 0))).toEqual([-1, 0, 1, 2, 3]);
  expect(ids(applyKeyedScenario(baseline, "prepend", 7))).toEqual([-8, 0, 1, 2, 3]);
});

test("keyed browser workload rejects too-small item sets", () => {
  expect(() => createKeyedItems(3)).toThrow("at least 4");
});
