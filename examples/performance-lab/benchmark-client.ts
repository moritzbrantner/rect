import {
  frameworkIds,
  type BenchmarkConfig,
  type BenchmarkResult,
  type ErrorMessage,
  type FixtureMessage,
  type FrameworkId,
  type KeyedBenchmarkConfig,
  type KeyedBenchmarkResult,
  type KeyedResultMessage,
  type ReadyMessage,
  type ResultMessage,
} from "./benchmark-contract.ts";

const fixtureTimeoutMs = 60_000;

type FixtureRunConfig = BenchmarkConfig | KeyedBenchmarkConfig;
type FixtureRunResult = BenchmarkResult | KeyedBenchmarkResult;
type ResultFixtureMessage = ResultMessage | KeyedResultMessage;

function isFrameworkId(value: string | null): value is FrameworkId {
  return frameworkIds.includes(value as FrameworkId);
}

function isFixtureMessage(value: unknown): value is FixtureMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = Reflect.get(value, "type");
  return (
    type === "rect:benchmark-ready" ||
    type === "rect:benchmark-result" ||
    type === "rect:keyed-benchmark-result" ||
    type === "rect:benchmark-error"
  );
}

function fixtureUrl(framework: FrameworkId): string {
  const url = new URL("fixtures/runner.html", document.baseURI);
  url.searchParams.set("framework", framework);
  return url.href;
}

async function runFixture<Result extends FixtureRunResult>(
  framework: FrameworkId,
  config: FixtureRunConfig,
  requestType: "rect:benchmark-run" | "rect:keyed-benchmark-run",
  resultType: "rect:benchmark-result" | "rect:keyed-benchmark-result",
): Promise<Result> {
  return await new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.className = "benchmark-frame";
    iframe.title = `${framework} benchmark fixture`;
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = fixtureUrl(framework);

    const runId = crypto.randomUUID();
    let ready = false;

    const finish = (): void => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      iframe.remove();
    };

    const fail = (message: string): void => {
      finish();
      reject(new Error(message));
    };

    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframe.contentWindow ||
        !isFixtureMessage(event.data)
      ) {
        return;
      }

      if (event.data.type === "rect:benchmark-ready") {
        const message = event.data as ReadyMessage;
        if (ready || message.framework !== framework || !isFrameworkId(message.framework)) return;
        ready = true;
        iframe.contentWindow?.postMessage(
          { type: requestType, runId, config },
          window.location.origin,
        );
        return;
      }

      if (event.data.type === resultType) {
        const message = event.data as ResultFixtureMessage;
        if (message.runId !== runId) return;
        finish();
        resolve(message.result as Result);
        return;
      }

      if (event.data.type !== "rect:benchmark-error") return;
      const message = event.data as ErrorMessage;
      if (message.runId === runId) fail(message.message);
    };

    const timeout = window.setTimeout(
      () => fail(`${framework} fixture exceeded ${fixtureTimeoutMs / 1000}s.`),
      fixtureTimeoutMs,
    );

    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}

export async function runFrameworkBenchmark(
  framework: FrameworkId,
  config: BenchmarkConfig,
): Promise<BenchmarkResult> {
  return await runFixture<BenchmarkResult>(
    framework,
    config,
    "rect:benchmark-run",
    "rect:benchmark-result",
  );
}

export async function runRectKeyedBenchmark(
  config: KeyedBenchmarkConfig,
): Promise<KeyedBenchmarkResult> {
  return await runFixture<KeyedBenchmarkResult>(
    "rect",
    config,
    "rect:keyed-benchmark-run",
    "rect:keyed-benchmark-result",
  );
}
