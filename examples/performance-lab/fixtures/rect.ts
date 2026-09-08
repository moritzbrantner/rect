import { jsx, mount } from "../../../src/dom.ts";
import { keyed } from "../../../src/keyed.ts";
import { derived, state } from "../../../src/reactivity.ts";
import { keyedScenarioIds, type KeyedScenarioId } from "../benchmark-contract.ts";
import {
  applyKeyedScenario,
  createKeyedItems,
  type KeyedWorkloadItem,
} from "../keyed-workload.ts";

export default {
  label: "Rect",
  version: "0.0.0",
  implementation: "Rect reference runtime · direct DOM + shared tracked text fan-out",
  assetUrl: import.meta.url,
  keyedScenarios: keyedScenarioIds,
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
  mountKeyed(target: HTMLElement, itemCount: number) {
    const baseline = createKeyedItems(itemCount);
    const [items, setItems] = state<readonly KeyedWorkloadItem[]>(baseline);
    const list = keyed(
      items,
      (item) => item.id,
      (item, index) => {
        const key = item().id;
        const text = derived(() => `${index()}:${item().label}`);
        return jsx("span", {
          className: "keyed-fixture-item",
          "data-key": String(key),
          children: text,
        });
      },
    );
    const dispose = mount(jsx("div", { className: "keyed-fixture", children: list }), target);

    return {
      applyKeyed(scenario: KeyedScenarioId, sample: number) {
        const next = applyKeyedScenario(baseline, scenario, sample);
        setItems(next);
        return next.map((item) => ({ key: item.id, label: item.label }));
      },
      resetKeyed() {
        setItems(baseline);
      },
      readKeyedEntries() {
        return [...target.querySelectorAll<HTMLElement>(".keyed-fixture-item")].map((element) => ({
          key: Number(element.dataset.key),
          node: element,
          text: element.textContent ?? "",
        }));
      },
      dispose,
    };
  },
};
