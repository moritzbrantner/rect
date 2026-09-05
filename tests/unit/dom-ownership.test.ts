import { afterAll, expect, test } from "bun:test";

import { effect, onCleanup, state } from "../../src/reactivity.ts";

class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  appendChild(child: FakeNode): FakeNode {
    if (child instanceof FakeDocumentFragment) {
      for (const nested of [...child.childNodes]) this.appendChild(nested);
      child.childNodes = [];
      return child;
    }

    if (child.parentNode) {
      child.parentNode.childNodes = child.parentNode.childNodes.filter(
        (nested) => nested !== child,
      );
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  replaceChildren(...children: FakeNode[]): void {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    for (const child of children) this.appendChild(child);
  }
}

class FakeDocumentFragment extends FakeNode {}

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
    createDocumentFragment: () => new FakeDocumentFragment(),
    createElement: () => new FakeElement(),
    createTextNode: (value: string) => new FakeText(value),
  },
});

const { jsx, mount } = await import("../../src/dom.ts");

afterAll(() => {
  Object.assign(globalThis, originalGlobals);
});

test(
  "mount replacement disposes the old component owner without breaking shared text fan-out",
  () => {
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
  },
);
