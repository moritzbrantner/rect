import {
  frameworkIds,
  type BenchmarkConfig,
  type BenchmarkResult,
  type ErrorMessage,
  type FixtureMessage,
  type FrameworkId,
  type ReadyMessage,
  type ResultMessage,
  type RunMessage,
} from "./benchmark-contract.ts";

const fixtureTimeoutMs = 60_000;

function isFrameworkId(value: string | null): value is FrameworkId {
  return frameworkIds.includes(value as FrameworkId);
}

function isFixtureMessage(value: unknown): value is FixtureMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = Reflect.get(value, "type");
  return (
    type === "rect:benchmark-ready" ||
    type === "rect:benchmark-result" ||
    type === "rect:benchmark-error"
  );
}

function fixtureUrl(framework: FrameworkId): string {
  const url = new URL("fixtures/runner.html", document.baseURI);
  url.searchParams.set("framework", framework);
  return url.href;
}

export async function runFrameworkBenchmark(
  framework: FrameworkId,
  config: BenchmarkConfig,
): Promise<BenchmarkResult> {
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
        const request: RunMessage = { type: "rect:benchmark-run", runId, config };
        iframe.contentWindow?.postMessage(request, window.location.origin);
        return;
      }

      if (event.data.type === "rect:benchmark-result") {
        const message = event.data as ResultMessage;
        if (message.runId !== runId) return;
        finish();
        resolve(message.result);
        return;
      }

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
