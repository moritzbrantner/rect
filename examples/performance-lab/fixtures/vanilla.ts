export default {
  label: "Vanilla DOM",
  version: "browser",
  implementation: "Imperative DOM reference",
  assetUrl: import.meta.url,
  notes: ["Direct text-node writes provide the lower-level browser reference for this workload."],
  mount(target: HTMLElement, nodeCount: number) {
    const root = document.createElement("div");
    root.className = "fixture-grid";
    const textNodes: Text[] = [];

    for (let index = 0; index < nodeCount; index += 1) {
      const cell = document.createElement("span");
      cell.className = "fixture-cell";
      const text = document.createTextNode("0");
      textNodes.push(text);
      cell.appendChild(text);
      root.appendChild(cell);
    }
    target.replaceChildren(root);

    return {
      update(nextValue: number) {
        const text = String(nextValue);
        for (const node of textNodes) node.data = text;
      },
      readFirst() {
        return textNodes[0]?.data ?? "";
      },
      readLast() {
        return textNodes[textNodes.length - 1]?.data ?? "";
      },
      dispose() {
        target.replaceChildren();
      },
    };
  },
};
