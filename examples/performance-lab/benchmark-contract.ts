export const frameworkIds = ["rect", "vanilla", "react", "preact", "solid"] as const;
export const keyedScenarioIds = [
  "append",
  "prepend",
  "reorder",
  "sparse-removal",
  "adversarial-movement",
] as const;

export type FrameworkId = (typeof frameworkIds)[number];
export type KeyedScenarioId = (typeof keyedScenarioIds)[number];

export type BenchmarkConfig = {
  nodes: number;
  updates: number;
  mountSamples: number;
  warmupUpdates: number;
};

export type KeyedBenchmarkConfig = {
  items: number;
  samples: number;
  warmupSamples: number;
};

export type Distribution = {
  p50: number;
  p95: number;
  p99: number;
};

export type BenchmarkResult = {
  framework: FrameworkId;
  label: string;
  version: string;
  implementation: string;
  config: BenchmarkConfig;
  firstMountMs: number;
  mountMs: Distribution;
  updateMs: Distribution;
  mutationsPerUpdate: number;
  appBundleBytes: number | null;
  runtimeTransferBytes: number | null;
  heapDeltaBytes: number | null;
  verified: boolean;
  notes: readonly string[];
};

export type KeyedScenarioResult = {
  scenario: KeyedScenarioId;
  latencyMs: Distribution;
  mutationRecords: Distribution;
  verified: boolean;
};

export type KeyedBenchmarkResult = {
  framework: "rect";
  config: KeyedBenchmarkConfig;
  scenarios: readonly KeyedScenarioResult[];
  verified: boolean;
  notes: readonly string[];
};

export type ReadyMessage = {
  type: "rect:benchmark-ready";
  framework: FrameworkId;
};

export type RunMessage = {
  type: "rect:benchmark-run";
  runId: string;
  config: BenchmarkConfig;
};

export type ResultMessage = {
  type: "rect:benchmark-result";
  runId: string;
  result: BenchmarkResult;
};

export type KeyedRunMessage = {
  type: "rect:keyed-benchmark-run";
  runId: string;
  config: KeyedBenchmarkConfig;
};

export type KeyedResultMessage = {
  type: "rect:keyed-benchmark-result";
  runId: string;
  result: KeyedBenchmarkResult;
};

export type ErrorMessage = {
  type: "rect:benchmark-error";
  runId: string;
  message: string;
};

export type FixtureMessage = ReadyMessage | ResultMessage | KeyedResultMessage | ErrorMessage;
