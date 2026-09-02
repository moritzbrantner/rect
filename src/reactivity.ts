export type Accessor<T> = () => T;
export type StateUpdate<T> = T | ((previous: T) => T);
export type Setter<T> = (update: StateUpdate<T>) => T;

type SubscriberSet = Set<ReactiveEffect>;

type ReactiveEffect = {
  active: boolean;
  dependencies: Set<SubscriberSet>;
  execute: () => void;
};

let activeEffect: ReactiveEffect | undefined;
const accessors = new WeakSet<Function>();

function cleanup(effect: ReactiveEffect): void {
  for (const subscribers of effect.dependencies) {
    subscribers.delete(effect);
  }
  effect.dependencies.clear();
}

export function effect(run: () => void): () => void {
  const reactiveEffect: ReactiveEffect = {
    active: true,
    dependencies: new Set(),
    execute: () => {
      if (!reactiveEffect.active) return;

      cleanup(reactiveEffect);
      const previous = activeEffect;
      activeEffect = reactiveEffect;
      try {
        run();
      } finally {
        activeEffect = previous;
      }
    },
  };

  reactiveEffect.execute();

  return () => {
    if (!reactiveEffect.active) return;
    reactiveEffect.active = false;
    cleanup(reactiveEffect);
  };
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
    for (const subscriber of [...subscribers]) {
      subscriber.execute();
    }
    return value;
  };

  return [read, write] as const;
}

export function isAccessor(value: unknown): value is Accessor<unknown> {
  return typeof value === "function" && accessors.has(value);
}
