import { batch, createSignal } from "solid-js";
import { render } from "solid-js/web";

export default {
  label: "Solid",
  version: "1.9.15",
  implementation: "Solid 1.9.15 · babel-preset-solid 1.9.15 DOM output",
  assetUrl: import.meta.url,
  notes: [
    "The fixture is authored as Solid JSX and compiled with the matching official babel-preset-solid DOM transform before Bun bundles it.",
  ],
  mount(target, nodeCount) {
    let setValue = null;
    const dispose = render(() => {
      const [value, writeValue] = createSignal(0);
      setValue = writeValue;
      const cells = Array.from({ length: nodeCount }, () => (
        <span class="fixture-cell">{value()}</span>
      ));
      return <div class="fixture-grid">{cells}</div>;
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
  batchedNotes: [
    "Each cell owns an independent Solid signal; batch() groups all signal writes into one reactive flush.",
  ],
  mountBatched(target, valueCount) {
    let entries = null;
    const dispose = render(() => {
      entries = Array.from({ length: valueCount }, (_, index) => createSignal(index));
      const cells = entries.map(([value]) => <span class="fixture-cell">{value()}</span>);
      return <div class="fixture-grid">{cells}</div>;
    }, target);

    if (!entries) throw new Error("Solid batched benchmark signals did not mount.");

    return {
      update(base) {
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
