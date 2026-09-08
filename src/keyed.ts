import { jsx, mount, type Child } from "./dom.ts";
import {
  batch,
  effect,
  getOwner,
  onCleanup,
  runWithOwner,
  state,
  untrack,
  type Accessor,
  type ReactiveOwner,
  type Setter,
} from "./reactivity.ts";

export type Key = string | number | symbol;
export type KeyedRenderer<T> = (item: Accessor<T>, index: Accessor<number>) => Child;

type KeyedRecord<T, K extends Key> = {
  carrier: DocumentFragment;
  dispose: () => void;
  end: Comment;
  index: Accessor<number>;
  item: Accessor<T>;
  key: K;
  setIndex: Setter<number>;
  setItem: Setter<T>;
  start: Comment;
};

type Descriptor<T, K extends Key> = {
  index: number;
  item: T;
  key: K;
};

function createRecord<T, K extends Key>(
  owner: ReactiveOwner | undefined,
  descriptor: Descriptor<T, K>,
  render: KeyedRenderer<T>,
): KeyedRecord<T, K> {
  const [item, setItem] = state(descriptor.item);
  const [index, setIndex] = state(descriptor.index);
  const carrier = document.createDocumentFragment();
  const start = document.createComment("rect:keyed:item");
  const end = document.createComment("/rect:keyed:item");
  const child = runWithOwner(owner, () => jsx(() => untrack(() => render(item, index)), null));
  const dispose = mount([start, child, end], carrier as unknown as Element);

  return {
    carrier,
    dispose,
    end,
    index,
    item,
    key: descriptor.key,
    setIndex,
    setItem,
    start,
  };
}

function moveIntoCarrier<T, K extends Key>(record: KeyedRecord<T, K>): void {
  if (record.start.parentNode === record.carrier) return;

  let node: Node | null = record.start;
  let foundEnd = false;
  while (node) {
    const next: Node | null = node.nextSibling;
    record.carrier.appendChild(node);
    if (node === record.end) {
      foundEnd = true;
      break;
    }
    node = next;
  }

  if (!foundEnd) {
    throw new Error("Rect keyed collection lost an item boundary.");
  }
}

function disposeRecord<T, K extends Key>(record: KeyedRecord<T, K>): void {
  moveIntoCarrier(record);
  record.dispose();
}

function moveBefore<T, K extends Key>(
  parent: Node,
  record: KeyedRecord<T, K>,
  reference: Node,
): void {
  if (record.end.nextSibling === reference) return;
  moveIntoCarrier(record);
  parent.insertBefore(record.carrier, reference);
}

function createDescriptors<T, K extends Key>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Descriptor<T, K>[] {
  return untrack(() => {
    const seen = new Set<K>();
    return items.map((item, index) => {
      const key = keyOf(item);
      if (seen.has(key)) {
        throw new Error(`Rect keyed() received duplicate key: ${String(key)}`);
      }
      seen.add(key);
      return { index, item, key };
    });
  });
}

function createRegion<T, K extends Key>(
  items: Accessor<readonly T[]>,
  keyOf: (item: T) => K,
  render: KeyedRenderer<T>,
): Child {
  const owner = getOwner();
  const fragment = document.createDocumentFragment();
  const start = document.createComment("rect:keyed");
  const end = document.createComment("/rect:keyed");
  fragment.appendChild(start);
  fragment.appendChild(end);

  let recordsByKey = new Map<K, KeyedRecord<T, K>>();
  let orderedRecords: KeyedRecord<T, K>[] = [];

  const reconcile = () => {
    const descriptors = createDescriptors(items(), keyOf);
    const prepared = new Map<K, KeyedRecord<T, K>>();

    try {
      for (const descriptor of descriptors) {
        if (recordsByKey.has(descriptor.key)) continue;
        prepared.set(descriptor.key, createRecord(owner, descriptor, render));
      }
    } catch (error) {
      for (const record of prepared.values()) disposeRecord(record);
      throw error;
    }

    const parent = end.parentNode;
    if (!parent) {
      for (const record of prepared.values()) disposeRecord(record);
      throw new Error("Rect keyed collection lost its DOM boundary.");
    }

    const nextKeys = new Set(descriptors.map((descriptor) => descriptor.key));
    for (const record of orderedRecords) {
      if (!nextKeys.has(record.key)) disposeRecord(record);
    }

    const nextRecords: KeyedRecord<T, K>[] = [];
    const nextRecordsByKey = new Map<K, KeyedRecord<T, K>>();
    for (const descriptor of descriptors) {
      const retained = recordsByKey.get(descriptor.key);
      const record = retained ?? prepared.get(descriptor.key);
      if (!record) {
        throw new Error("Rect keyed collection could not resolve a prepared item.");
      }

      if (retained) {
        record.setItem(() => descriptor.item);
        record.setIndex(descriptor.index);
      }
      nextRecords.push(record);
      nextRecordsByKey.set(descriptor.key, record);
    }

    let reference: Node = end;
    for (let index = nextRecords.length - 1; index >= 0; index -= 1) {
      const record = nextRecords[index]!;
      if (prepared.has(record.key)) {
        parent.insertBefore(record.carrier, reference);
      } else {
        moveBefore(parent, record, reference);
      }
      reference = record.start;
    }

    orderedRecords = nextRecords;
    recordsByKey = nextRecordsByKey;
  };

  const stop = effect(() => batch(reconcile));

  onCleanup(() => {
    stop();
    const records = orderedRecords;
    orderedRecords = [];
    recordsByKey = new Map();

    let firstError: unknown;
    let hasError = false;
    for (const record of records) {
      try {
        disposeRecord(record);
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    }
    if (hasError) throw firstError;
  });

  return fragment;
}

export function keyed<T, K extends Key>(
  items: Accessor<readonly T[]>,
  keyOf: (item: T) => K,
  render: KeyedRenderer<T>,
): Node {
  return jsx(() => createRegion(items, keyOf, render), null);
}
