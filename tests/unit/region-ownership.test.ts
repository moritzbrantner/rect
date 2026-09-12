import { afterAll, expect, test } from "bun:test";

import { consume, createContext, onCleanup, provide, state } from "../../src/reactivity.ts";

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
      for (const nested of nestedChildren) this.insertBefore(nested, reference);
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
  constructor(public data: string) {
    super();
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

const { jsx, mount, show } = await import("../../src/dom.ts");
const { keyed } = await import("../../src/keyed.ts");

afterAll(() => {
  Object.assign(globalThis, originalGlobals);
});

test("multi-node component owners clean up after nested show regions leave the live DOM", () => {
  const [visible] = state(true);
  const target = new FakeElement();
  let branchNode: FakeElement | undefined;
  let branchParentDuringCleanup: FakeNode | null | undefined;
  let appParentDuringCleanup: FakeNode | null | undefined;

  function App() {
    onCleanup(() => {
      appParentDuringCleanup = branchNode?.parentNode;
    });
    return [
      jsx("span", { className: "prefix", children: "prefix" }),
      show(visible, () => {
        const node = jsx("span", { className: "branch", children: "branch" }) as FakeElement;
        branchNode = node;
        onCleanup(() => {
          branchParentDuringCleanup = node.parentNode;
        });
        return node;
      }),
    ];
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(branchNode?.parentNode).toBe(target);

  dispose();

  expect(branchParentDuringCleanup).toBeNull();
  expect(appParentDuringCleanup).toBeNull();
});

test("keyed item owners clean up after their complete record leaves the live DOM", () => {
  const [items, setItems] = state<readonly { id: string }[]>([{ id: "a" }]);
  const target = new FakeElement();
  let first: FakeElement | undefined;
  let second: FakeElement | undefined;
  let parentsDuringCleanup: readonly (FakeNode | null)[] | undefined;

  function App() {
    return keyed(
      items,
      (item) => item.id,
      () => {
        first = jsx("span", { className: "first", children: "first" }) as FakeElement;
        second = jsx("span", { className: "second", children: "second" }) as FakeElement;
        onCleanup(() => {
          parentsDuringCleanup = [first?.parentNode ?? null, second?.parentNode ?? null];
        });
        return [first, second];
      },
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(first?.parentNode).toBe(target);
  expect(second?.parentNode).toBe(target);

  setItems([]);

  expect(parentsDuringCleanup).toEqual([null, null]);
  dispose();
});

test("keyed region owners preserve provider context for items created later", () => {
  const theme = createContext<string>();
  const [items, setItems] = state<readonly { id: string }[]>([{ id: "a" }]);
  const target = new FakeElement();
  const seen: string[] = [];

  function App() {
    return provide(theme, "dark", () =>
      keyed(
        items,
        (item) => item.id,
        (item) => {
          seen.push(`${item().id}:${consume(theme)}`);
          return jsx("span", { children: item().id });
        },
      ),
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  setItems([{ id: "a" }, { id: "b" }]);

  expect(seen).toEqual(["a:dark", "b:dark"]);
  dispose();
});
