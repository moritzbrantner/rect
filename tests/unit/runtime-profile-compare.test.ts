import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const command = new URL("../../scripts/runtime-profile-compare.sh", import.meta.url).pathname;

function invoke(program: string, args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(program, args, { encoding: "utf8", env: { ...process.env, ...env } });
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "rect-runtime-pilot-"));
  const reference = join(root, "reference-checkout");
  const candidate = join(root, "candidate-checkout");
  const output = join(root, "evidence");
  const profiler = join(root, "runtime-profiler");
  const evaluator = join(root, "moonlight-runtime-profile");
  for (const checkout of [reference, candidate]) {
    const scenario = join(checkout, "profiles/runtime-profiler/state.json");
    mkdirSync(dirname(scenario), { recursive: true });
    writeFileSync(scenario, '{"schema_version":"runtime-profiler/scenario/v1"}\n');
    expect(invoke("git", ["init", "-q", checkout]).status).toBe(0);
    expect(invoke("git", ["-C", checkout, "add", "."]).status).toBe(0);
    expect(
      invoke("git", [
        "-C",
        checkout,
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=x@y.z",
        "commit",
        "-qm",
        "scenario",
      ]).status,
    ).toBe(0);
  }
  writeFileSync(
    profiler,
    '#!/usr/bin/env bash\nset -eu\n[[ "$1" == capture ]] || exit 9\nshift\nwhile [[ $# -gt 0 ]]; do\n  if [[ "$1" == --output ]]; then mkdir "$2"; fi\n  shift\ndone\nprintf \'{"captured":true}\\n\'\n',
  );
  writeFileSync(
    evaluator,
    '#!/usr/bin/env bash\nprintf \'{"outcome":"inconclusive"}\\n\'\nexit 3\n',
  );
  chmodSync(profiler, 0o755);
  chmodSync(evaluator, 0o755);
  const env = { RUNTIME_PROFILER_BIN: profiler, MOONLIGHT_RUNTIME_PROFILE_BIN: evaluator };
  return { root, reference, candidate, output, env };
}

test("runtime pilot preserves distinct inconclusive Moonlight outcome and immutable bundle outputs", () => {
  const value = fixture();
  try {
    const result = invoke(
      "bash",
      [command, value.reference, value.candidate, value.output],
      value.env,
    );
    expect(result.status).toBe(3);
    expect(result.stdout).toContain('"outcome":"inconclusive"');
    expect(existsSync(join(value.output, "reference"))).toBe(true);
    expect(existsSync(join(value.output, "candidate"))).toBe(true);
    expect(readFileSync(join(value.output, "evaluation.json"), "utf8")).toContain("inconclusive");
    expect(readFileSync(join(value.output, "reference-revision.txt"), "utf8")).toMatch(
      /^[a-f0-9]{40}\n$/,
    );

    const repeated = invoke(
      "bash",
      [command, value.reference, value.candidate, value.output],
      value.env,
    );
    expect(repeated.status).toBe(2);
    expect(repeated.stderr).toContain("refusing to overwrite existing evidence");
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test("runtime pilot refuses changed scenario bytes and dirty checkouts before capture", () => {
  const value = fixture();
  try {
    const candidateScenario = join(value.candidate, "profiles/runtime-profiler/state.json");
    writeFileSync(candidateScenario, '{"id":"changed"}\n');
    const changed = invoke(
      "bash",
      [command, value.reference, value.candidate, value.output],
      value.env,
    );
    expect(changed.status).toBe(2);
    expect(changed.stderr).toContain("scenario bytes differ");
    expect(existsSync(value.output)).toBe(false);

    writeFileSync(candidateScenario, '{"schema_version":"runtime-profiler/scenario/v1"}\n');
    writeFileSync(join(value.candidate, "dirty-file"), "untracked\n");
    const dirty = invoke(
      "bash",
      [command, value.reference, value.candidate, value.output],
      value.env,
    );
    expect(dirty.status).toBe(2);
    expect(dirty.stderr).toContain("checkout is dirty");
    expect(existsSync(value.output)).toBe(false);
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});
