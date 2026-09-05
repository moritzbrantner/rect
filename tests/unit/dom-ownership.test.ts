import { afterAll, expect, test } from "bun:test";

import { consume, createContext, effect, onCleanup, provide, state } from "../../src/reactivity.ts";

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

    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }

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
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes = [];
    for (const child of children) {
      this.appendChild(child);
    }
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

const { jsx, mount, show } = await import("../../src/dom.ts");

afterAll(() => {
  Object.assign(globalThis, originalGlobals);
});

function elementChildren(node: FakeNode): FakeElement[] {
  return node.childNodes.filter((child): child is FakeElement => child instanceof FakeElement);
}

function textOf(element: FakeElement): string {
  const text = element.firstChild;
  return text instanceof FakeText ? text.data : "";
}

test("disposes replaced component owners", () => {
  const [value, setValue] = state(0);
  const target = new FakeElement();
  let executions = 0;
  let cleanups = 0;

  function Component() {
    effect(() => {
      value();
      executions += 1;
    });
    onCleanup(() => {
      cleanups += 1;
    });
    return jsx("span", { children: value });
  }

  const first = jsx(Component, null);
  mount(first, target as unknown as Element);
  expect(executions).toBe(1);

  setValue(1);
  expect(executions).toBe(2);

  const second = jsx(Component, null);
  expect(executions).toBe(3);

  const dispose = mount(second, target as unknown as Element);
  expect(cleanups).toBe(1);

  setValue(2);
  expect(executions).toBe(4);
  const span = target.firstChild as FakeElement;
  expect((span.firstChild as FakeText).data).toBe("2");

  dispose();
  expect(cleanups).toBe(2);
  expect(target.childNodes).toHaveLength(0);

  setValue(3);
  expect(executions).toBe(4);
});

test("show switches branches and disposes inactive branch owners immediately", () => {
  const [visible, setVisible] = state(true);
  const [value, setValue] = state(0);
  const target = new FakeElement();
  let trueMounts = 0;
  let falseMounts = 0;
  let trueEffects = 0;
  let falseEffects = 0;
  let trueCleanups = 0;
  let falseCleanups = 0;

  function TrueBranch() {
    trueMounts += 1;
    effect(() => {
      value();
      trueEffects += 1;
    });
    onCleanup(() => {
      trueCleanups += 1;
    });
    return jsx("span", { className: "true", children: value });
  }

  function FalseBranch() {
    falseMounts += 1;
    effect(() => {
      value();
      falseEffects += 1;
    });
    onCleanup(() => {
      falseCleanups += 1;
    });
    return jsx("span", { className: "false", children: value });
  }

  function App() {
    return show(visible, () => jsx(TrueBranch, null), () => jsx(FalseBranch, null));
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(elementChildren(target).map((element) => element.className)).toEqual(["true"]);
  expect(trueMounts).toBe(1);
  expect(falseMounts).toBe(0);

  setValue(1);
  expect(trueEffects).toBe(2);

  setVisible(false);
  expect(trueCleanups).toBe(1);
  expect(falseMounts).toBe(1);
  expect(elementChildren(target).map((element) => element.className)).toEqual(["false"]);

  setValue(2);
  expect(trueEffects).toBe(2);
  expect(falseEffects).toBe(2);

  setVisible(true);
  expect(falseCleanups).toBe(1);
  expect(trueMounts).toBe(2);
  expect(elementChildren(target).map((element) => element.className)).toEqual(["true"]);

  dispose();
  expect(trueCleanups).toBe(2);
  expect(target.childNodes).toHaveLength(0);

  setVisible(false);
  expect(falseMounts).toBe(1);
});

test("show disposes the old branch before constructing its replacement", () => {
  const [visible, setVisible] = state(true);
  const [value, setValue] = state(0);
  const target = new FakeElement();
  const seen: number[] = [];

  function TrueBranch() {
    effect(() => {
      seen.push(value());
    });
    return jsx("span", { children: "true" });
  }

  function App() {
    return show(
      visible,
      () => jsx(TrueBranch, null),
      () => {
        setValue(1);
        return jsx("span", { children: "false" });
      },
    );
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(seen).toEqual([0]);

  setVisible(false);
  expect(seen).toEqual([0]);

  dispose();
});

test("show tracks only its condition and not incidental branch reads", () => {
  const [visible] = state(true);
  const [incidental, setIncidental] = state(0);
  const target = new FakeElement();
  let renders = 0;

  function App() {
    return show(visible, () => {
      incidental();
      renders += 1;
      return jsx("span", { children: "visible" });
    });
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(renders).toBe(1);

  setIncidental(1);
  expect(renders).toBe(1);

  dispose();
});

test("show preserves owner-tree context when a branch is created later", () => {
  const theme = createContext<string>();
  const [visible, setVisible] = state(false);
  const target = new FakeElement();
  const seen: string[] = [];
  let cleanups = 0;

  function ThemedBranch() {
    const value = consume(theme);
    seen.push(value);
    onCleanup(() => {
      cleanups += 1;
    });
    return jsx("span", { className: value, children: value });
  }

  function App() {
    return provide(theme, "dark", () => show(visible, () => jsx(ThemedBranch, null)));
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(elementChildren(target)).toHaveLength(0);

  setVisible(true);
  expect(seen).toEqual(["dark"]);
  expect(elementChildren(target).map((element) => element.className)).toEqual(["dark"]);

  setVisible(false);
  expect(cleanups).toBe(1);
  expect(elementChildren(target)).toHaveLength(0);

  dispose();
});

test("show recreates shared dynamic text fan-out from the latest value", () => {
  const [visible, setVisible] = state(true);
  const [value, setValue] = state(1);
  const target = new FakeElement();

  function App() {
    return show(visible, () => [
      jsx("span", { className: "first", children: value }),
      jsx("span", { className: "last", children: value }),
    ]);
  }

  const dispose = mount(jsx(App, null), target as unknown as Element);
  expect(elementChildren(target).map(textOf)).toEqual(["1", "1"]);

  setValue(2);
  expect(elementChildren(target).map(textOf)).toEqual(["2", "2"]);

  setVisible(false);
  expect(elementChildren(target)).toHaveLength(0);

  setValue(3);
  setVisible(true);
  expect(elementChildren(target).map(textOf)).toEqual(["3", "3"]);

  dispose();
});
