import { Component, h, options, render } from "preact";

options.debounceRendering = (callback) => callback();

class BenchmarkView extends Component {
  constructor(props) {
    super(props);
    this.state = { value: 0 };
  }

  updateValue(value) {
    this.setState({ value });
  }

  render({ nodeCount }, { value }) {
    const cells = Array.from({ length: nodeCount }, (_, index) =>
      h("span", { className: "fixture-cell", key: index }, value),
    );
    return h("div", { className: "fixture-grid" }, cells);
  }
}

export default {
  label: "Preact",
  version: "10.29.8",
  implementation: "Preact renderer · synchronous scheduler for measurement",
  assetUrl: import.meta.url,
  notes: [
    "The benchmark overrides Preact's debounce scheduler so each measured update reaches the DOM synchronously.",
  ],
  mount(target, nodeCount) {
    let controller = null;
    render(h(BenchmarkView, { nodeCount, ref: (value) => (controller = value) }), target);
    if (!controller) throw new Error("Preact benchmark controller did not mount.");

    return {
      update(nextValue) {
        controller.updateValue(nextValue);
      },
      readFirst() {
        return target.querySelector(".fixture-cell")?.textContent ?? "";
      },
      readLast() {
        const cells = target.querySelectorAll(".fixture-cell");
        return cells.item(cells.length - 1).textContent ?? "";
      },
      dispose() {
        render(null, target);
      },
    };
  },
};
