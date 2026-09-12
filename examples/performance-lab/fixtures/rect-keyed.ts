import { jsx, mount } from "../../../src/dom.ts";
import { keyed } from "../../../src/keyed.ts";
import { derived, state } from "../../../src/reactivity.ts";
import { keyedScenarioIds, type KeyedScenarioId } from "../benchmark-contract.ts";
import { applyKeyedScenario, createKeyedItems, type KeyedWorkloadItem } from "../keyed-workload.ts";

export default {
  keyedScenarios: keyedScenarioIds,
  mount(target: HTMLElement, itemCount: number) {
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
      prepareKeyed(scenario: KeyedScenarioId, sample: number) {
        return applyKeyedScenario(baseline, scenario, sample);
      },
      applyKeyed(next: readonly KeyedWorkloadItem[]) {
        setItems(next);
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
