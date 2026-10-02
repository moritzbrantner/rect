import { jsx, mount } from "../../../src/dom.ts";
import { batch, state } from "../../../src/reactivity.ts";

export default {
  label: "Rect",
  version: "0.0.0",
  implementation: "Rect reference runtime · direct DOM + shared tracked text fan-out",
  assetUrl: import.meta.url,
  notes: [
    "Rect v0 reference runtime: no compiler transform is used for this fixture.",
    "Repeated uses of one accessor share reactive tracking and one text conversion per update.",
  ],
  mount(target: HTMLElement, nodeCount: number) {
    const [value, setValue] = state(0);
    const cells = Array.from({ length: nodeCount }, () =>
      jsx("span", { className: "fixture-cell", children: value }),
    );
    const dispose = mount(jsx("div", { className: "fixture-grid", children: cells }), target);

    return {
      update(nextValue: number) {
        setValue(nextValue);
      },
      readFirst() {
        return target.querySelector(".fixture-cell")?.textContent ?? "";
      },
      readLast() {
        const cells = target.querySelectorAll(".fixture-cell");
        return cells.item(cells.length - 1).textContent ?? "";
      },
      dispose,
    };
  },
  batchedNotes: [
    "Each cell owns an independent Rect state; batch() groups all setters into one downstream flush.",
  ],
  mountBatched(target: HTMLElement, valueCount: number) {
    const entries = Array.from({ length: valueCount }, (_, index) => state(index));
    const cells = entries.map(([value]) =>
      jsx("span", { className: "fixture-cell", children: value }),
    );
    const dispose = mount(jsx("div", { className: "fixture-grid", children: cells }), target);

    return {
      update(base: number) {
        batch(() => {
          for (let index = 0; index < entries.length; index += 1) {
            entries[index]?.[1](base + index);
          }
        });
      },
      readValues() {
        return Array.from(
          target.querySelectorAll(".fixture-cell"),
          (cell) => cell.textContent ?? "",
        );
      },
      dispose,
    };
  },
};
