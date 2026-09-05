import { jsx, mount } from "../../../src/dom.ts";
import { state } from "../../../src/reactivity.ts";

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
};
