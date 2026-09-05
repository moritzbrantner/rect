export type Accessor<T> = () => T;
export type StateUpdate<T> = T | ((previous: T) => T);
export type Setter<T> = (update: StateUpdate<T>) => T;
export type Context<T> = {
  readonly key: symbol;
  readonly defaultValue: T | undefined;
  readonly hasDefault: boolean;
};

export type ReactiveOwner = {
  active: boolean;
  parent?: ReactiveOwner;
  children: Set<ReactiveOwner>;
  cleanups: Set<Disposer>;
  contexts: Map<symbol, unknown>;
};

type Disposer = () => void;
type SubscriberSet = Set<ReactiveEffect>;
type ReactiveEffect = {
  active: boolean;
  dependencies: Set<SubscriberSet>;
  execute: () => void;
};

let activeEffect: ReactiveEffect | undefined;
let activeOwner: ReactiveOwner | undefined;
let activeFlushQueue: Set<ReactiveEffect> | undefined;
let batchDepth = 0;
let flushingEffects = false;

const accessors = new WeakSet<Function>();
const pendingEffects = new Set<ReactiveEffect>();

function cleanupEffect(effect: ReactiveEffect): void {
  for (const subscribers of effect.dependencies) {
    subscribers.delete(effect);
  }
  effect.dependencies.clear();
}

function queueEffect(effect: ReactiveEffect): void {
  if (!effect.active || activeFlushQueue?.has(effect)) return;
  pendingEffects.add(effect);
}

function notifySubscribers(subscribers: SubscriberSet): void {
  for (const subscriber of subscribers) {
    queueEffect(subscriber);
  }
  flushPendingEffects();
}

function flushPendingEffects(): void {
  if (flushingEffects || batchDepth > 0) return;

  flushingEffects = true;
  let firstError: unknown;
  let hasError = false;
  try {
    while (pendingEffects.size > 0) {
      const queued = [...pendingEffects];
      pendingEffects.clear();
      activeFlushQueue = new Set(queued);
      for (const reactiveEffect of queued) {
        activeFlushQueue.delete(reactiveEffect);
        try {
          reactiveEffect.execute();
        } catch (error) {
          if (!hasError) {
            firstError = error;
            hasError = true;
          }
        }
      }
      activeFlushQueue = undefined;
    }
  } finally {
    activeFlushQueue = undefined;
    flushingEffects = false;
  }

  if (hasError) throw firstError;
}

export function createOwner(parent: ReactiveOwner | undefined = activeOwner): ReactiveOwner {
  const owner: ReactiveOwner = {
    active: true,
    parent,
    children: new Set(),
    cleanups: new Set(),
    contexts: new Map(),
  };
  if (parent?.active) parent.children.add(owner);
  return owner;
}

export function getOwner(): ReactiveOwner | undefined {
  return activeOwner;
}

export function runWithOwner<T>(owner: ReactiveOwner | undefined, run: () => T): T {
  const previous = activeOwner;
  activeOwner = owner;
  try {
    return run();
  } finally {
    activeOwner = previous;
  }
}

export function disposeOwner(owner: ReactiveOwner): void {
  if (!owner.active) return;
  owner.active = false;

  let firstError: unknown;
  let hasError = false;
  for (const child of [...owner.children]) {
    try {
      disposeOwner(child);
    } catch (error) {
      if (!hasError) {
        firstError = error;
        hasError = true;
      }
    }
  }
  owner.children.clear();

  for (const cleanup of [...owner.cleanups]) {
    try {
      cleanup();
    } catch (error) {
      if (!hasError) {
        firstError = error;
        hasError = true;
      }
    }
  }
  owner.cleanups.clear();
  owner.parent?.children.delete(owner);

  if (hasError) throw firstError;
}

export function onCleanup(cleanup: Disposer): void {
  if (!activeOwner?.active) {
    throw new Error("onCleanup() must run while Rect is creating an owned component subtree.");
  }
  activeOwner.cleanups.add(() => cleanup());
}

export function effect(run: () => void): Disposer {
  const owner = activeOwner?.active ? activeOwner : undefined;
  const reactiveEffect: ReactiveEffect = {
    active: true,
    dependencies: new Set(),
    execute: () => {
      if (!reactiveEffect.active) return;

      cleanupEffect(reactiveEffect);
      const previous = activeEffect;
      activeEffect = reactiveEffect;
      try {
        run();
      } finally {
        activeEffect = previous;
      }
    },
  };

  const dispose = () => {
    if (!reactiveEffect.active) return;
    reactiveEffect.active = false;
    pendingEffects.delete(reactiveEffect);
    cleanupEffect(reactiveEffect);
    owner?.cleanups.delete(dispose);
  };
  owner?.cleanups.add(dispose);

  try {
    reactiveEffect.execute();
  } catch (error) {
    dispose();
    throw error;
  }

  return dispose;
}

export function state<T>(initial: T): readonly [Accessor<T>, Setter<T>] {
  let value = initial;
  const subscribers: SubscriberSet = new Set();

  const read: Accessor<T> = () => {
    if (activeEffect) {
      subscribers.add(activeEffect);
      activeEffect.dependencies.add(subscribers);
    }
    return value;
  };
  accessors.add(read);

  const write: Setter<T> = (update) => {
    const next = typeof update === "function" ? (update as (previous: T) => T)(value) : update;

    if (Object.is(value, next)) return value;

    value = next;
    notifySubscribers(subscribers);
    return value;
  };

  return [read, write] as const;
}

export function derived<T>(compute: () => T): Accessor<T> {
  let initialized = false;
  let value!: T;
  const subscribers: SubscriberSet = new Set();

  const read: Accessor<T> = () => {
    if (activeEffect) {
      subscribers.add(activeEffect);
      activeEffect.dependencies.add(subscribers);
    }
    return value;
  };
  accessors.add(read);

  effect(() => {
    const next = compute();
    if (initialized && Object.is(value, next)) return;

    value = next;
    if (!initialized) {
      initialized = true;
      return;
    }
    notifySubscribers(subscribers);
  });

  return read;
}

export function batch<T>(run: () => T): T {
  batchDepth += 1;
  try {
    return run();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) flushPendingEffects();
  }
}

export function untrack<T>(read: () => T): T {
  const previous = activeEffect;
  activeEffect = undefined;
  try {
    return read();
  } finally {
    activeEffect = previous;
  }
}

export function createContext<T>(defaultValue?: T): Context<T> {
  return {
    key: Symbol("rect.context"),
    defaultValue,
    hasDefault: arguments.length > 0,
  };
}

export function provide<T, R>(context: Context<T>, value: T, run: () => R): R {
  if (!activeOwner?.active) {
    throw new Error("provide() must run while Rect is creating an owned component subtree.");
  }

  const owner = createOwner(activeOwner);
  owner.contexts.set(context.key, value);
  try {
    return runWithOwner(owner, run);
  } catch (error) {
    disposeOwner(owner);
    throw error;
  }
}

export function consume<T>(context: Context<T>): T {
  let owner = activeOwner;
  while (owner) {
    if (owner.contexts.has(context.key)) {
      return owner.contexts.get(context.key) as T;
    }
    owner = owner.parent;
  }

  if (context.hasDefault) return context.defaultValue as T;
  throw new Error("consume() could not find a provided Rect context value.");
}

export function isAccessor(value: unknown): value is Accessor<unknown> {
  return typeof value === "function" && accessors.has(value);
}
