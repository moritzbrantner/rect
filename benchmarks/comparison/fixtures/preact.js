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

function flushBatchedUpdates(run) {
  const previousDebounceRendering = options.debounceRendering;
  let scheduledFlush = null;
  options.debounceRendering = (callback) => {
    scheduledFlush ??= callback;
  };
  try {
    run();
  } finally {
    options.debounceRendering = previousDebounceRendering;
  }
  scheduledFlush?.();
}

class BatchedCell extends Component {
  constructor(props) {
    super(props);
    this.state = { value: props.index };
  }

  updateValue(value) {
    this.setState({ value });
  }

  render(_, { value }) {
    return h("span", { className: "fixture-cell" }, value);
  }
}

class BatchedView extends Component {
  constructor(props) {
    super(props);
    this.controllers = [];
  }

  updateValues(base) {
    flushBatchedUpdates(() => {
      for (let index = 0; index < this.controllers.length; index += 1) {
        this.controllers[index]?.updateValue(base + index);
      }
    });
  }

  render({ valueCount }) {
    const cells = Array.from({ length: valueCount }, (_, index) =>
      h(BatchedCell, {
        key: index,
        index,
        ref: (controller) => {
          this.controllers[index] = controller;
        },
      }),
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
  batchedNotes: [
    "Each cell owns independent Preact component state; the documented render queue is held and flushed once synchronously per batch.",
  ],
  mountBatched(target, valueCount) {
    let controller = null;
    render(h(BatchedView, { valueCount, ref: (value) => (controller = value) }), target);
    if (!controller) throw new Error("Preact batched benchmark controller did not mount.");

    return {
      update(base) {
        controller.updateValues(base);
      },
      readValues() {
        return Array.from(
          target.querySelectorAll(".fixture-cell"),
          (cell) => cell.textContent ?? "",
        );
      },
      dispose() {
        render(null, target);
      },
    };
  },
};
