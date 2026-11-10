import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROBE = join(import.meta.dir, "fixtures", "telemetry-probe.ts");

type Sent = {
  url: string;
  headers: Record<string, string>;
  body: {
    event: string;
    global_properties: Record<string, unknown>;
  };
};

/**
 * Builds a runtime in a fresh process, because the SDK reads the sample rate and the opt-outs once,
 * when its telemetry client is created. Runs from an empty directory so Bun loads no `.env`.
 */
async function capture(
  overrides: Record<string, string> = {},
): Promise<Sent[]> {
  const directory = await mkdtemp(join(tmpdir(), "openduet-telemetry-"));
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of [
    "DO_NOT_TRACK",
    "COPILOTKIT_TELEMETRY_DISABLED",
    "COPILOTKIT_TELEMETRY_SAMPLE_RATE",
    "COPILOTKIT_TELEMETRY_URL",
    "COPILOTKIT_LICENSE_TOKEN",
  ])
    delete env[key];
  try {
    const child = Bun.spawn([process.execPath, PROBE], {
      cwd: directory,
      env: { ...env, CPK_TELEMETRY_ID: "test-project-identity", ...overrides },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) throw new Error(`probe exited ${code}: ${stderr}`);
    return JSON.parse(stdout.trim().split("\n").at(-1) ?? "[]");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("runtime telemetry removal", () => {
  test("sends no events even when inherited settings explicitly enable analytics", async () => {
    expect(await capture()).toEqual([]);
    expect(
      await capture({
        DO_NOT_TRACK: "0",
        COPILOTKIT_TELEMETRY_DISABLED: "false",
        COPILOTKIT_TELEMETRY_SAMPLE_RATE: "1",
      }),
    ).toEqual([]);
  });
});
