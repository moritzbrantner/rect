import { effect, isAccessor, type Accessor } from "./reactivity.ts";

export type Child =
  | Node
  | Accessor<unknown>
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Child[];

export type Component = (props: Record<string, unknown>) => Child;

const nodeDisposers = new WeakMap<Node, Set<() => void>>();

function registerDisposer(node: Node, dispose: () => void): void {
  const existing = nodeDisposers.get(node);
  if (existing) {
    existing.add(dispose);
    return;
  }
  nodeDisposers.set(node, new Set([dispose]));
}

function disposeTree(node: Node): void {
  for (const child of [...node.childNodes]) {
    disposeTree(child);
  }
  const disposers = nodeDisposers.get(node);
  if (!disposers) return;

  for (const dispose of disposers) dispose();
  nodeDisposers.delete(node);
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  throw new TypeError("Rect v0 dynamic JSX children must resolve to text-like values.");
}

function dynamicText(accessor: Accessor<unknown>): Text {
  const node = document.createTextNode("");
  const dispose = effect(() => {
    node.data = textValue(accessor());
  });
  registerDisposer(node, dispose);
  return node;
}

function appendChild(parent: Node, child: Child): void {
  if (child === null || child === undefined || typeof child === "boolean") {
    return;
  }

  if (Array.isArray(child)) {
    for (const nested of child) appendChild(parent, nested);
    return;
  }

  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }

  if (isAccessor(child)) {
    parent.appendChild(dynamicText(child));
    return;
  }

  if (typeof child === "string" || typeof child === "number" || typeof child === "bigint") {
    parent.appendChild(document.createTextNode(String(child)));
    return;
  }

  throw new TypeError(`Unsupported Rect child: ${typeof child}`);
}

function applyProp(element: HTMLElement, key: string, value: unknown): void {
  if (key === "children" || key === "key") return;

  if (key === "ref") {
    if (typeof value !== "function") {
      throw new TypeError("Rect refs must be callback functions.");
    }
    (value as (node: HTMLElement) => void)(element);
    return;
  }

  if (key === "className") {
    if (value !== null && value !== undefined) element.className = String(value);
    return;
  }

  if (key === "htmlFor") {
    if (value !== null && value !== undefined) {
      element.setAttribute("for", String(value));
    }
    return;
  }

  if (key === "style") {
    if (value !== null && value !== undefined) {
      if (typeof value !== "string") {
        throw new TypeError("Rect v0 style props must be CSS strings.");
      }
      element.style.cssText = value;
    }
    return;
  }

  if (/^on[A-Z]/.test(key)) {
    if (typeof value !== "function") {
      throw new TypeError(`${key} must be an event handler.`);
    }
    element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    return;
  }

  if (value === null || value === undefined || value === false) return;

  if (key in element && !key.startsWith("aria-") && !key.startsWith("data-")) {
    Reflect.set(element, key, value);
    return;
  }

  element.setAttribute(key, value === true ? "" : String(value));
}

export const Fragment = Symbol("rect.fragment");

export function jsx(
  type: string | typeof Fragment | Component,
  props: Record<string, unknown> | null,
): Node {
  const normalizedProps = props ?? {};

  if (type === Fragment) {
    const fragment = document.createDocumentFragment();
    appendChild(fragment, normalizedProps.children as Child);
    return fragment;
  }

  if (typeof type === "function") {
    const fragment = document.createDocumentFragment();
    appendChild(fragment, type(normalizedProps));
    if (fragment.childNodes.length === 1) {
      return fragment.firstChild as Node;
    }
    return fragment;
  }

  const element = document.createElement(type);
  for (const [key, value] of Object.entries(normalizedProps)) {
    applyProp(element, key, value);
  }
  appendChild(element, normalizedProps.children as Child);
  return element;
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export function mount(child: Child, target: Element): () => void {
  for (const existing of [...target.childNodes]) {
    disposeTree(existing);
  }
  target.replaceChildren();
  appendChild(target, child);

  return () => {
    for (const existing of [...target.childNodes]) {
      disposeTree(existing);
    }
    target.replaceChildren();
  };
}
