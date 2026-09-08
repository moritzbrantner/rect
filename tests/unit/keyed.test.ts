import { afterAll, expect, test } from "bun:test";

import { derived, onCleanup, state } from "../../src/reactivity.ts";

class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get nextSibling(): FakeNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return index === -1 ? null : (this.parentNode.childNodes[index + 1] ?? null);
  }

  appendChild(child: FakeNode): FakeNode {
    return this.insertBefore(child, null);
  }

  insertBefore(child: FakeNode, reference: FakeNode | null): FakeNode {
    if (child instanceof FakeDocumentFragment) {
      const nestedChildren = child.childNodes.slice();
      for (const nested of nestedChildren) {
        this.insertBefore(nested, reference);
      }
      child.childNodes = [];
      return child;
    }

    if (child.parentNode) child.parentNode.removeChild(child);

    const index = reference === null ? this.childNodes.length : this.childNodes.indexOf(reference);
    if (index === -1) throw new Error("Reference node is not a child.");

    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild(child: FakeNode): FakeNode {
    const index = this.childNodes.indexOf(child);
    if (index === -1) throw new Error("Node is not a child.");
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  replaceChildren(...children: FakeNode[]): void {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    for (const child of children) this.appendChild(child);
  }
}

class FakeDocumentFragment extends FakeNode {}
class FakeComment extends FakeNode {}

class FakeText extends FakeNode {
  data: string;

  constructor(data: string) {
    super();
    this.data = data;
  }
}

class FakeElement extends FakeNode {
  className = "";
  style = { cssText: "" };
  attributes = new Map<string, string>();

  addEventListener(): void {}

  setAttribute(key: string, value: string): void {
    this.attributes.set(key, value);
  }
}

const originalGlobals = {
  DocumentFragment: globalThis.DocumentFragment,
  HTMLElement: globalThis.HTMLElement,
  Node: globalThis.Node,
  document: globalThis.document,
};

Object.assign(globalThis, {
  DocumentFragment: FakeDocumentFragment,
  HTMLElement: FakeElement,
  Node: FakeNode,
  document: {
    createComment: () => new FakeComment(),
    createDocumentFragment: () => new FakeDocumentFragment(),
    createElement: () => new FakeElement(),
    createTextNode: (value: string) => new FakeText(value),
  },
});

const { jsx, mount } = await import("../../src/dom.ts");
const { keyed } = await import("../../src/keyed.ts");

afterAll(() => {
  Object.assign(globalThis, originalGlobals);
});

type Item = {
  id: string;
  label: string;
};

function elementChildren(node: FakeNode): FakeElement[] {
  return node.childNodes.filter((child): child is FakeElement => child instanceof FakeElement);
}

function textOf(element: FakeElement): string {
  const text = element.firstChild;
  return text instanceof FakeText ? text.data : "";
}

test("keyed collections move retained DOM while preserving item owners", () => {
  const [items, setItems] = state<readonly Item[]>([
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ]);
  const target = new FakeElement();
  const mounts: string[] = [];
  const cleanups: string[] = [];

  function App() {
    return keyed(
      items,
      (item) => item.id,
      (item, index) => {
        const id = item().id;
        mounts.push(id);
        onCleanup(() => cleanups.push(id));
        const text = derived(() => `${index()}:${item().label}`);
        return jsx("span", { className: id, children: text });
      },
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  const initialElements = elementChildren(target);
  expect(initialElements.map((element) => element.className)).toEqual(["a", "b", "c"]);
  expect(initialElements.map(textOf)).toEqual(["0:A", "1:B", "2:C"]);
  expect(mounts).toEqual(["a", "b", "c"]);

  setItems([
    { id: "c", label: "C2" },
    { id: "a", label: "A2" },
    { id: "b", label: "B2" },
  ]);

  const movedElements = elementChildren(target);
  expect(movedElements.map((element) => element.className)).toEqual(["c", "a", "b"]);
  expect(movedElements.map(textOf)).toEqual(["0:C2", "1:A2", "2:B2"]);
  expect(movedElements[0]).toBe(initialElements[2]);
  expect(movedElements[1]).toBe(initialElements[0]);
  expect(movedElements[2]).toBe(initialElements[1]);
  expect(mounts).toEqual(["a", "b", "c"]);
  expect(cleanups).toEqual([]);

  dispose();
  expect(cleanups.toSorted()).toEqual(["a", "b", "c"]);
});

test("keyed collections dispose removed owners and create only new keys", () => {
  const [items, setItems] = state<readonly Item[]>([
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ]);
  const target = new FakeElement();
  const mounts: string[] = [];
  const cleanups: string[] = [];

  function App() {
    return keyed(
      items,
      (item) => item.id,
      (item) => {
        const id = item().id;
        mounts.push(id);
        onCleanup(() => cleanups.push(id));
        return jsx("span", { className: id, children: derived(() => item().label) });
      },
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);

  setItems([
    { id: "a", label: "A2" },
    { id: "c", label: "C2" },
    { id: "d", label: "D" },
  ]);

  expect(elementChildren(target).map((element) => element.className)).toEqual(["a", "c", "d"]);
  expect(elementChildren(target).map(textOf)).toEqual(["A2", "C2", "D"]);
  expect(mounts).toEqual(["a", "b", "c", "d"]);
  expect(cleanups).toEqual(["b"]);

  dispose();
  expect(cleanups.toSorted()).toEqual(["a", "b", "c", "d"]);
});

test("keyed collections reject duplicate keys before mutating the current region", () => {
  const [items, setItems] = state<readonly Item[]>([
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ]);
  const target = new FakeElement();

  function App() {
    return keyed(
      items,
      (item) => item.id,
      (item) => jsx("span", { className: item().id, children: derived(() => item().label) }),
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  const before = elementChildren(target);

  expect(() =>
    setItems([
      { id: "a", label: "A duplicate one" },
      { id: "a", label: "A duplicate two" },
    ]),
  ).toThrow("duplicate key");

  expect(elementChildren(target)).toEqual(before);
  expect(elementChildren(target).map(textOf)).toEqual(["A", "B"]);

  setItems([
    { id: "b", label: "B2" },
    { id: "a", label: "A2" },
  ]);
  expect(elementChildren(target).map((element) => element.className)).toEqual(["b", "a"]);
  expect(elementChildren(target).map(textOf)).toEqual(["B2", "A2"]);

  dispose();
});

test("key selection and item construction do not widen the collection dependency set", () => {
  const [items] = state<readonly Item[]>([{ id: "a", label: "A" }]);
  const [incidental, setIncidental] = state(0);
  const target = new FakeElement();
  let keyReads = 0;
  let renders = 0;

  function App() {
    return keyed(
      items,
      (item) => {
        incidental();
        keyReads += 1;
        return item.id;
      },
      (item) => {
        incidental();
        renders += 1;
        return jsx("span", { children: item().label });
      },
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(keyReads).toBe(1);
  expect(renders).toBe(1);

  setIncidental(1);
  expect(keyReads).toBe(1);
  expect(renders).toBe(1);

  dispose();
});

test("keyed collections defer source updates triggered during item construction", () => {
  const [items, setItems] = state<readonly Item[]>([{ id: "a", label: "A" }]);
  const target = new FakeElement();
  const mounts: string[] = [];
  const cleanups: string[] = [];
  let expanded = false;

  function App() {
    return keyed(
      items,
      (item) => item.id,
      (item) => {
        const id = item().id;
        mounts.push(id);
        onCleanup(() => cleanups.push(id));
        if (!expanded && id === "a") {
          expanded = true;
          setItems([
            { id: "a", label: "A2" },
            { id: "b", label: "B" },
          ]);
        }
        return jsx("span", { className: id, children: derived(() => item().label) });
      },
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);

  expect(elementChildren(target).map((element) => element.className)).toEqual(["a", "b"]);
  expect(elementChildren(target).map(textOf)).toEqual(["A2", "B"]);
  expect(mounts).toEqual(["a", "b"]);
  expect(cleanups).toEqual([]);

  dispose();
  expect(cleanups.toSorted()).toEqual(["a", "b"]);
});

test("keyed collections retain callable items without invoking them as state updaters", () => {
  type CallableItem = (() => string) & {
    id: string;
    label: string;
  };

  const calls: string[] = [];
  const createItem = (label: string): CallableItem =>
    Object.assign(
      () => {
        calls.push(label);
        return label;
      },
      { id: "a", label },
    );
  const first = createItem("A");
  const replacement = createItem("A2");
  const [items, setItems] = state<readonly CallableItem[]>([first]);
  const target = new FakeElement();

  function App() {
    return keyed(
      items,
      (item) => item.id,
      (item) =>
        jsx("span", {
          className: item().id,
          children: derived(() => item().label),
        }),
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  const initial = elementChildren(target)[0]!;
  expect(textOf(initial)).toBe("A");

  setItems([replacement]);

  const retained = elementChildren(target)[0]!;
  expect(retained).toBe(initial);
  expect(textOf(retained)).toBe("A2");
  expect(calls).toEqual([]);

  dispose();
});
