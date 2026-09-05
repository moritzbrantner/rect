import {
  createOwner,
  disposeOwner,
  effect,
  getOwner,
  isAccessor,
  runWithOwner,
  untrack,
  type Accessor,
  type ReactiveOwner,
} from "./reactivity.ts";

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
export type ConditionalBranch = () => Child;

type Disposer = () => void;
type NodeDisposers = Disposer | Set<Disposer>;
type DynamicTextBinding = {
  dispose?: Disposer;
  nodes: Set<Text>;
  value: string;
};

const nodeDisposers = new WeakMap<Node, NodeDisposers>();
const dynamicTextBindings = new WeakMap<Accessor<unknown>, DynamicTextBinding>();

function registerDisposer(node: Node, dispose: Disposer): void {
  const existing = nodeDisposers.get(node);
  if (!existing) {
    nodeDisposers.set(node, dispose);
    return;
  }
  if (typeof existing === "function") {
    nodeDisposers.set(node, new Set([existing, dispose]));
    return;
  }
  existing.add(dispose);
}

function moveDisposers(from: Node, to: Node): void {
  const disposers = nodeDisposers.get(from);
  if (!disposers) return;

  nodeDisposers.delete(from);
  if (typeof disposers === "function") {
    registerDisposer(to, disposers);
    return;
  }
  for (const dispose of disposers) registerDisposer(to, dispose);
}

function disposeNode(node: Node): void {
  const disposers = nodeDisposers.get(node);
  if (!disposers) return;

  if (typeof disposers === "function") {
    disposers();
  } else {
    for (const dispose of disposers) dispose();
  }
  nodeDisposers.delete(node);
}

function disposeTree(node: Node): void {
  for (const child of [...node.childNodes]) {
    disposeTree(child);
  }
  disposeNode(node);
}

function disposeDetachedTree(root: Node): void {
  for (const child of root.childNodes) {
    disposeTree(child);
  }
  disposeNode(root);
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

function createDynamicTextBinding(accessor: Accessor<unknown>): DynamicTextBinding {
  const binding: DynamicTextBinding = {
    nodes: new Set(),
    value: "",
  };
  binding.dispose = runWithOwner(undefined, () =>
    effect(() => {
      const value = textValue(accessor());
      binding.value = value;
      for (const node of binding.nodes) node.data = value;
    }),
  );
  dynamicTextBindings.set(accessor, binding);
  return binding;
}

function dynamicText(accessor: Accessor<unknown>): Text {
  const binding = dynamicTextBindings.get(accessor) ?? createDynamicTextBinding(accessor);
  const node = document.createTextNode(binding.value);
  binding.nodes.add(node);
  registerDisposer(node, () => {
    binding.nodes.delete(node);
    if (binding.nodes.size !== 0) return;

    binding.dispose?.();
    dynamicTextBindings.delete(accessor);
  });
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

  if (child instanceof DocumentFragment) {
    moveDisposers(child, child.firstChild ?? parent);
    parent.appendChild(child);
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

function disposeConditionalBranch(
  start: Comment,
  end: Comment,
  owner: ReactiveOwner | undefined,
): void {
  let firstError: unknown;
  let hasError = false;
  let node = start.nextSibling;

  while (node && node !== end) {
    const next = node.nextSibling;
    try {
      disposeTree(node);
    } catch (error) {
      if (!hasError) {
        firstError = error;
        hasError = true;
      }
    }
    node.parentNode?.removeChild(node);
    node = next;
  }

  if (owner) {
    try {
      disposeOwner(owner);
    } catch (error) {
      if (!hasError) {
        firstError = error;
        hasError = true;
      }
    }
  }

  if (hasError) throw firstError;
}

function createConditionalBranch(
  parentOwner: ReactiveOwner | undefined,
  branch: ConditionalBranch,
): { owner: ReactiveOwner; fragment: DocumentFragment } {
  const owner = createOwner(parentOwner);
  const fragment = document.createDocumentFragment();

  try {
    const child = runWithOwner(owner, () => untrack(branch));
    appendChild(fragment, child);
    return { owner, fragment };
  } catch (error) {
    disposeDetachedTree(fragment);
    disposeOwner(owner);
    throw error;
  }
}

export const Fragment = Symbol("rect.fragment");

export function show(
  condition: Accessor<boolean>,
  whenTrue: ConditionalBranch,
  whenFalse: ConditionalBranch = () => null,
): Node {
  const parentOwner = getOwner();
  const fragment = document.createDocumentFragment();
  const start = document.createComment("rect:show");
  const end = document.createComment("/rect:show");
  fragment.appendChild(start);
  fragment.appendChild(end);

  let activeValue: boolean | undefined;
  let activeBranchOwner: ReactiveOwner | undefined;

  const replaceBranch = (nextValue: boolean) => {
    const next = createConditionalBranch(parentOwner, nextValue ? whenTrue : whenFalse);
    const parent = end.parentNode;
    if (!parent) {
      disposeDetachedTree(next.fragment);
      disposeOwner(next.owner);
      throw new Error("Rect conditional region lost its DOM boundary.");
    }

    try {
      disposeConditionalBranch(start, end, activeBranchOwner);
      parent.insertBefore(next.fragment, end);
    } catch (error) {
      disposeDetachedTree(next.fragment);
      disposeOwner(next.owner);
      throw error;
    }

    activeBranchOwner = next.owner;
    activeValue = nextValue;
  };

  const stop = effect(() => {
    const nextValue = condition();
    if (activeValue === nextValue) return;
    replaceBranch(nextValue);
  });

  registerDisposer(start, () => {
    stop();
    const owner = activeBranchOwner;
    activeBranchOwner = undefined;
    activeValue = undefined;
    disposeConditionalBranch(start, end, owner);
  });

  return fragment;
}

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
    const owner = createOwner(getOwner());
    let child: Child;
    try {
      child = runWithOwner(owner, () => type(normalizedProps));
    } catch (error) {
      disposeOwner(owner);
      throw error;
    }

    const fragment = document.createDocumentFragment();
    appendChild(fragment, child);
    const dispose = () => disposeOwner(owner);
    if (fragment.childNodes.length === 1) {
      const node = fragment.firstChild as Node;
      moveDisposers(fragment, node);
      registerDisposer(node, dispose);
      return node;
    }
    registerDisposer(fragment, dispose);
    return fragment;
  }

  const element = document.createElement(type);
  for (const key in normalizedProps) {
    if (Object.hasOwn(normalizedProps, key)) {
      applyProp(element, key, normalizedProps[key]);
    }
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
  disposeNode(target);
  target.replaceChildren();
  appendChild(target, child);

  return () => {
    for (const existing of [...target.childNodes]) {
      disposeTree(existing);
    }
    disposeNode(target);
    target.replaceChildren();
  };
}
