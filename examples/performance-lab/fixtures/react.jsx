/** @jsxImportSource react */
import { createRef, forwardRef, useImperativeHandle, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const BenchmarkView = forwardRef(function BenchmarkView({ nodeCount }, ref) {
  const [value, setValue] = useState(0);
  useImperativeHandle(ref, () => ({ setValue }), []);

  const cells = Array.from({ length: nodeCount }, (_, index) => (
    <span className="fixture-cell" key={index}>
      {value}
    </span>
  ));
  return <div className="fixture-grid">{cells}</div>;
});

export default {
  label: "React + Compiler",
  version: "19.2.8",
  implementation: "React 19.2.8 · Bun 1.4 React Compiler · flushSync updates",
  assetUrl: import.meta.url,
  notes: [
    "This source is passed through Bun 1.4's built-in React Compiler during the Pages build.",
    "flushSync keeps the measured state-to-DOM update boundary synchronous.",
  ],
  mount(target, nodeCount) {
    const root = createRoot(target);
    const controller = createRef();
    flushSync(() => root.render(<BenchmarkView ref={controller} nodeCount={nodeCount} />));
    if (!controller.current) throw new Error("React benchmark controller did not mount.");

    return {
      update(nextValue) {
        flushSync(() => controller.current.setValue(nextValue));
      },
      readFirst() {
        return target.querySelector(".fixture-cell")?.textContent ?? "";
      },
      readLast() {
        const cells = target.querySelectorAll(".fixture-cell");
        return cells.item(cells.length - 1).textContent ?? "";
      },
      dispose() {
        flushSync(() => root.unmount());
      },
    };
  },
};
