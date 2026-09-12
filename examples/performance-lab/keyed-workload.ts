import type { KeyedScenarioId } from "./benchmark-contract.ts";

export type KeyedWorkloadItem = Readonly<{
  id: number;
  label: string;
}>;

export function createKeyedItems(itemCount: number): readonly KeyedWorkloadItem[] {
  if (!Number.isInteger(itemCount) || itemCount < 4) {
    throw new RangeError("Keyed benchmark item count must be an integer of at least 4.");
  }

  return Array.from({ length: itemCount }, (_, index) => ({
    id: index,
    label: `Item ${index}`,
  }));
}

export function applyKeyedScenario(
  baseline: readonly KeyedWorkloadItem[],
  scenario: KeyedScenarioId,
  sample: number,
): readonly KeyedWorkloadItem[] {
  switch (scenario) {
    case "append":
      return [
        ...baseline,
        {
          id: baseline.length + sample,
          label: `Appended ${sample}`,
        },
      ];
    case "prepend":
      return [
        {
          id: -(sample + 1),
          label: `Prepended ${sample}`,
        },
        ...baseline,
      ];
    case "reorder": {
      const midpoint = Math.floor(baseline.length / 2);
      return [...baseline.slice(midpoint), ...baseline.slice(0, midpoint)];
    }
    case "sparse-removal":
      return baseline.filter((_, index) => (index + 1) % 4 !== 0);
    case "adversarial-movement":
      return baseline.toReversed();
  }
}
