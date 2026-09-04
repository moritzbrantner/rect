import { mount, state, type Accessor, type Setter } from "@rect/core";
import {
  frameworkIds,
  type BenchmarkConfig,
  type BenchmarkResult,
  type FrameworkId,
} from "./benchmark-contract.ts";
import { runFrameworkBenchmark } from "./benchmark-client.ts";

type RowModel = {
  id: FrameworkId;
  label: string;
  status: Accessor<string>;
  setStatus: Setter<string>;
  coldMount: Accessor<string>;
  setColdMount: Setter<string>;
  mount: Accessor<string>;
  setMount: Setter<string>;
  update: Accessor<string>;
  setUpdate: Setter<string>;
  mutations: Accessor<string>;
  setMutations: Setter<string>;
  bytes: Accessor<string>;
  setBytes: Setter<string>;
  heap: Accessor<string>;
  setHeap: Setter<string>;
};

const labels: Record<FrameworkId, string> = {
  rect: "Rect",
  vanilla: "Vanilla DOM",
  react: "React + Compiler",
  preact: "Preact",
  solid: "Solid",
};

function makeRow(id: FrameworkId): RowModel {
  const [status, setStatus] = state("Ready");
  const [coldMount, setColdMount] = state("—");
  const [mountValue, setMount] = state("—");
  const [updateValue, setUpdate] = state("—");
  const [mutations, setMutations] = state("—");
  const [bytes, setBytes] = state("—");
  const [heap, setHeap] = state("—");
  return {
    id,
    label: labels[id],
    status,
    setStatus,
    coldMount,
    setColdMount,
    mount: mountValue,
    setMount,
    update: updateValue,
    setUpdate,
    mutations,
    setMutations,
    bytes,
    setBytes,
    heap,
    setHeap,
  };
}

const rows = frameworkIds.map(makeRow);
const rowById = new Map(rows.map((row) => [row.id, row]));

function formatMs(value: number): string {
  if (value < 0.01) return `${(value * 1000).toFixed(1)} µs`;
  if (value < 1) return `${value.toFixed(3)} ms`;
  return `${value.toFixed(2)} ms`;
}

function formatBytes(value: number | null): string {
  if (value === null) return "n/a";
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KiB`;
}

function formatHeap(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${formatBytes(Math.abs(value))}`;
}

function applyResult(result: BenchmarkResult): void {
  const row = rowById.get(result.framework);
  if (!row) return;

  row.setStatus(result.verified ? "Verified" : "Failed verification");
  row.setColdMount(formatMs(result.firstMountMs));
  row.setMount(`${formatMs(result.mountMs.p50)} / ${formatMs(result.mountMs.p95)}`);
  row.setUpdate(
    `${formatMs(result.updateMs.p50)} / ${formatMs(result.updateMs.p95)} / ${formatMs(result.updateMs.p99)}`,
  );
  row.setMutations(result.mutationsPerUpdate.toFixed(0));
  row.setBytes(
    `${formatBytes(result.appBundleBytes)} + ${formatBytes(result.runtimeTransferBytes)}`,
  );
  row.setHeap(formatHeap(result.heapDeltaBytes));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function resultRow(row: RowModel): Node {
  return (
    <tr>
      <th scope="row">
        <span className="framework-name">{row.label}</span>
        <span className="status">{row.status}</span>
      </th>
      <td>{row.coldMount}</td>
      <td>{row.mount}</td>
      <td>{row.update}</td>
      <td>{row.mutations}</td>
      <td>{row.bytes}</td>
      <td>{row.heap}</td>
    </tr>
  );
}

function App(): Node {
  const [count, setCount] = state(0);
  const [progress, setProgress] = state("Ready to benchmark.");
  const [rawOutput, setRawOutput] = state("Run the suite to capture raw evidence.");

  let nodesInput: HTMLInputElement | undefined;
  let updatesInput: HTMLInputElement | undefined;
  let runButton: HTMLButtonElement | undefined;

  const runSuite = async (): Promise<void> => {
    const nodes = clampInteger(Number(nodesInput?.value ?? 1000), 10, 10_000);
    const updates = clampInteger(Number(updatesInput?.value ?? 40), 5, 250);
    const config: BenchmarkConfig = {
      nodes,
      updates,
      mountSamples: 15,
      warmupUpdates: Math.min(10, updates),
    };

    if (nodesInput) nodesInput.value = String(nodes);
    if (updatesInput) updatesInput.value = String(updates);
    if (runButton) runButton.disabled = true;

    const results: BenchmarkResult[] = [];
    for (const row of rows) {
      row.setStatus("Queued");
      row.setColdMount("—");
      row.setMount("—");
      row.setUpdate("—");
      row.setMutations("—");
      row.setBytes("—");
      row.setHeap("—");
    }

    try {
      for (const [index, framework] of frameworkIds.entries()) {
        const row = rowById.get(framework);
        row?.setStatus("Running");
        setProgress(`Running ${labels[framework]} (${index + 1}/${frameworkIds.length})…`);
        try {
          const result = await runFrameworkBenchmark(framework, config);
          results.push(result);
          applyResult(result);
        } catch (error) {
          row?.setStatus("Error");
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            framework,
            label: labels[framework],
            version: "unknown",
            implementation: "fixture error",
            config,
            firstMountMs: 0,
            mountMs: { p50: 0, p95: 0, p99: 0 },
            updateMs: { p50: 0, p95: 0, p99: 0 },
            mutationsPerUpdate: 0,
            appBundleBytes: null,
            runtimeTransferBytes: null,
            heapDeltaBytes: null,
            verified: false,
            notes: [message],
          });
        }
      }
      setProgress(
        `Finished ${results.filter((result) => result.verified).length}/${results.length} verified fixtures.`,
      );
      setRawOutput(JSON.stringify(results, null, 2));
    } finally {
      if (runButton) runButton.disabled = false;
    }
  };

  return (
    <main>
      <section className="hero shell">
        <p className="eyebrow">Rect performance lab · horizon 1</p>
        <h1>How little work can a UI framework do?</h1>
        <p className="lede">
          Rect runs components once, binds reactive text directly to DOM nodes, and deliberately
          avoids a virtual DOM. This page is itself rendered by Rect.
        </p>
        <div className="hero-actions">
          <button className="primary" type="button" onClick={() => setCount((value) => value + 1)}>
            Rect counter: {count}
          </button>
          <a className="secondary" href="https://github.com/moritzbrantner/rect">
            View source
          </a>
        </div>
      </section>

      <section className="shell benchmark-panel" aria-labelledby="benchmark-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Browser evidence</p>
            <h2 id="benchmark-title">Same reactive fan-out, five implementations</h2>
          </div>
          <p className="section-note">
            No aggregate winner score. Compare cold and warm mount cost, update latency, DOM
            mutations, served JavaScript and heap evidence separately.
          </p>
        </div>

        <div className="controls">
          <label>
            Reactive text nodes
            <input
              ref={(element: unknown) => {
                if (element instanceof HTMLInputElement) nodesInput = element;
              }}
              type="number"
              min="10"
              max="10000"
              value="1000"
            />
          </label>
          <label>
            Measured updates
            <input
              ref={(element: unknown) => {
                if (element instanceof HTMLInputElement) updatesInput = element;
              }}
              type="number"
              min="5"
              max="250"
              value="40"
            />
          </label>
          <button
            ref={(element: unknown) => {
              if (element instanceof HTMLButtonElement) runButton = element;
            }}
            className="primary"
            type="button"
            onClick={runSuite}
          >
            Run all benchmarks
          </button>
          <span className="progress" role="status">
            {progress}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Implementation</th>
                <th>Cold mount</th>
                <th>Warm mount p50 / p95</th>
                <th>Update p50 / p95 / p99</th>
                <th>DOM mutations / update</th>
                <th>App + runtime JS</th>
                <th>Heap delta</th>
              </tr>
            </thead>
            <tbody>{rows.map(resultRow)}</tbody>
          </table>
        </div>
        <p className="fine-print">
          The update workload changes one value observed by every text node. Mount samples run after
          module loading; cross-origin runtime bytes and heap data are reported only when the
          browser exposes them. Results are machine-local evidence, not universal rankings.
        </p>
      </section>

      <section className="shell grid-section">
        <article className="card">
          <p className="eyebrow">Rect execution</p>
          <h2>One component run</h2>
          <p>
            JSX creates real nodes immediately. Each dynamic text child owns exactly one text node
            and one reactive subscription. An update writes directly to that node.
          </p>
        </article>
        <article className="card">
          <p className="eyebrow">Comparison boundary</p>
          <h2>Comparable, not identical</h2>
          <p>
            React is compiled by Bun 1.4&apos;s built-in React Compiler. Preact uses its renderer.
            Solid uses its signal runtime with a compiler-shaped direct-DOM fixture. Vanilla is the
            lower-level reference.
          </p>
        </article>
        <article className="card">
          <p className="eyebrow">Deliberately missing</p>
          <h2>No keyed-list victory lap</h2>
          <p>
            Rect v0 does not yet own keyed collection semantics, so this lab does not benchmark
            them. A workload enters the suite only after Rect has a tested behavior contract for it.
          </p>
        </article>
      </section>

      <section className="shell evidence-panel" aria-labelledby="evidence-title">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Raw run</p>
            <h2 id="evidence-title">Evidence, not a headline</h2>
          </div>
        </div>
        <pre>{rawOutput}</pre>
      </section>
    </main>
  );
}

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) throw new Error("Missing #app mount point.");
mount(<App />, root);
