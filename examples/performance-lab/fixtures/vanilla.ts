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
  batchedNotes: [
    "Independent text nodes are updated in one direct synchronous loop as the lower-level batch reference.",
  ],
  mountBatched(target: HTMLElement, valueCount: number) {
    const root = document.createElement("div");
    root.className = "fixture-grid";
    const textNodes = Array.from({ length: valueCount }, (_, index) => {
      const cell = document.createElement("span");
      cell.className = "fixture-cell";
      const text = document.createTextNode(String(index));
      cell.appendChild(text);
      root.appendChild(cell);
      return text;
    });
    target.replaceChildren(root);

    return {
      update(base: number) {
        for (let index = 0; index < textNodes.length; index += 1) {
          const text = textNodes[index];
          if (text) text.data = String(base + index);
        }
      },
      readValues() {
        return textNodes.map((text) => text.data);
      },
      dispose() {
        target.replaceChildren();
      },
    };
  },
};
