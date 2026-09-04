import { createRenderEffect, createSignal } from "solid-js";
import { render } from "solid-js/web";

export default {
  label: "Solid",
  version: "1.9.15",
  implementation: "Solid 1.9.15 signal runtime · compiler-shaped direct DOM fixture",
  assetUrl: import.meta.url,
  notes: [
    "The fixture uses Solid's owned signal/render runtime with direct DOM creation, matching the compiler's fine-grained update shape without adding a second compiler toolchain to Rect.",
  ],
  mount(target, nodeCount) {
    let setValue = null;
    const dispose = render(() => {
      const [value, writeValue] = createSignal(0);
      setValue = writeValue;
      const root = document.createElement("div");
      root.className = "fixture-grid";

      for (let index = 0; index < nodeCount; index += 1) {
        const cell = document.createElement("span");
        cell.className = "fixture-cell";
        const text = document.createTextNode("");
        cell.appendChild(text);
        root.appendChild(cell);
        createRenderEffect(() => {
          text.data = String(value());
        });
      }
      return root;
    }, target);

    if (!setValue) throw new Error("Solid benchmark setter did not mount.");

    return {
      update(nextValue) {
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
