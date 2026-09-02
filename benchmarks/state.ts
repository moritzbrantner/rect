import { effect, state } from "../src/reactivity.ts";

function readIterations(argv: string[]): number {
  const index = argv.indexOf("--iterations");
  if (index === -1) return 100_000;

  const raw = argv[index + 1];
  const iterations = Number(raw);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) {
    throw new RangeError("--iterations must be a positive safe integer.");
  }
  return iterations;
}

const iterations = readIterations(process.argv);
const [value, setValue] = state(0);
let observed = -1;
let effectRuns = 0;

const dispose = effect(() => {
  observed = value();
  effectRuns += 1;
});

for (let index = 1; index <= iterations; index += 1) {
  setValue(index);
}

dispose();

if (observed !== iterations || effectRuns !== iterations + 1) {
  throw new Error(`state propagation mismatch: observed=${observed}, effectRuns=${effectRuns}`);
}

console.log(
  JSON.stringify({
    benchmark: "state-propagation",
    iterations,
    observed,
    effectRuns,
  }),
);
