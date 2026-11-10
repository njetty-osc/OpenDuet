import { HeadlessToolSuspension } from "@openbot/toolkit/headless-tools";
import { executeNativeApprovalTool } from "@openbot/toolkit/native-approval";
import { describe, expect, test } from "bun:test";
import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { z } from "zod";
import type { Observable } from "rxjs";
import {
  AcpAgent,
  acpLaunch,
  acpEnvironment,
  acpPrompt,
} from "../src/agents/acp-agent";
import { acpSettings, type AcpSettings } from "../src/agents/acp-config";
import {
  resolveRuntimeAgents,
  runtimeModelForEnvironment,
} from "../src/copilot";

const settings: AcpSettings = {
  acpProvider: "codex",
  acpCommand: process.execPath,
  acpArgs: [new URL("./fixtures/acp-fixture.mjs", import.meta.url).pathname],
  acpTimeoutMs: 5000,
  managedEndpoint: "http://localhost:4202/ag-ui",
};
const input: RunAgentInput = {
  threadId: "thread",
  runId: "run",
  messages: [{ id: "user", role: "user", content: "Use the probe" }],
  tools: [],
  state: {},
  context: [],
  forwardedProps: {},
};
async function collect(events: Observable<BaseEvent>) {
  const result: BaseEvent[] = [];
  await new Promise<void>((resolve, reject) =>
    events.subscribe({
      next: (event) => result.push(event),
      complete: resolve,
      error: reject,
    }),
  );
  return result;
}
const options = {
  model: "default",
  maxSteps: 3,
  prompt: "Use application tools",
  tools: [],
};

describe("ACP configuration", () => {
  test("validates explicit CLI settings and never falls back from an invalid selection", () => {
    expect(acpSettings({})).toBeUndefined();
    expect(acpSettings({ OPENBOT_AGENT_MODE: "acp" })?.acpProvider).toBe(
      "codex",
    );
    for (const env of [
      { OPENBOT_AGENT_MODE: "bad" },
      { OPENBOT_AGENT_MODE: "acp", OPENBOT_ACP_PROVIDER: "bad" },
      { OPENBOT_AGENT_MODE: "acp", OPENBOT_ACP_ARGS: "[1]" },
      { OPENBOT_AGENT_MODE: "acp", OPENBOT_ACP_TIMEOUT_MS: "0" },
    ])
      expect(() => acpSettings(env)).toThrow();
    expect(
      acpLaunch({ ...settings, acpCommand: undefined, acpProvider: "kiro" }),
    ).toEqual({ command: "kiro-cli", args: ["acp", "--agent", "openduet"] });
    expect(
      runtimeModelForEnvironment(
        { provider: "openai", defaultModel: "unused" },
        { OPENBOT_AGENT_MODE: "acp" },
      ).acp,
    ).toBeDefined();
  });
});

test("real ACP and stdio MCP execute a validated application tool and stream its result", async () => {
  let calls = 0;
  const agent = new AcpAgent(settings, {
    ...options,
    agentId: "coworker",
    tools: [
      {
        name: "openduet_probe",
        description: "probe",
        parameters: z.object({ text: z.string() }),
        execute: async (args) => {
          calls++;
          return args;
        },
      },
    ],
  });
  const events = await collect(agent.clone().run(input));
  expect(calls).toBe(1);
  expect(events.some((e) => e.type === EventType.RUN_ERROR)).toBe(false);
  expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT)).toBe(true);
  expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
});

test("invalid tool arguments never execute", async () => {
  let calls = 0;
  const events = await collect(
    new AcpAgent(settings, {
      ...options,
      tools: [
        {
          name: "openduet_probe",
          description: "probe",
          parameters: z.object({ count: z.number() }),
          execute: async () => {
            calls++;
            return {};
          },
        },
      ],
    }).run(input),
  );
  expect(calls).toBe(0);
  expect(JSON.stringify(events)).toContain("Invalid OpenDuet tool arguments");
});

test("surface tools end the run for client execution and have no forged server result", async () => {
  const events = await collect(
    new AcpAgent(settings, options).run({
      ...input,
      tools: [
        {
          name: "openduet_probe",
          description: "UI probe",
          parameters: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
      ],
    }),
  );
  expect(events.some((e) => e.type === EventType.TOOL_CALL_START)).toBe(true);
  expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT)).toBe(false);
  expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
});

test("provider timeout returns a run error", async () => {
  const events = await collect(
    new AcpAgent(
      {
        ...settings,
        acpArgs: [...settings.acpArgs, "--hang"],
        acpTimeoutMs: 300,
      },
      options,
    ).run(input),
  );
  expect(JSON.stringify(events)).toContain("timed out");
});

test("stopping a headless run settles without a fabricated error", async () => {
  const agent = new AcpAgent(
    { ...settings, acpArgs: [...settings.acpArgs, "--hang"] },
    options,
  );
  const events = collect(agent.run(input));
  setTimeout(() => agent.abortRun(), 50);
  expect((await events).some((e) => e.type === EventType.RUN_ERROR)).toBe(
    false,
  );
});

test("shared resolver routes managed coworkers to ACP without reading an API credential", async () => {
  let credentials = 0;
  const agents = await resolveRuntimeAgents(
    async () => [
      {
        id: "managed",
        name: "Managed",
        type: "remote_ag_ui" as const,
        endpoint: settings.managedEndpoint!,
        standingMessage: {
          id: "standing",
          role: "system" as const,
          content: "Coworker role",
        },
      },
    ],
    { provider: "openai", defaultModel: "unused", acp: settings },
    async () => {
      credentials++;
      return null;
    },
    undefined,
    async () => [
      {
        name: "openduet_probe",
        description: "probe",
        parameters: z.object({ text: z.string() }),
        execute: async () => "ok",
        ref: "fixture/probe",
      },
    ],
  );
  expect(credentials).toBe(0);
  const events = await collect(agents.managed!.clone().run(input));
  expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT)).toBe(true);
  expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
});

test("ACP subprocesses do not inherit application credentials or analytics identity", () => {
  const env = acpEnvironment({
    HOME: "/tmp/fixture-home",
    PATH: "/bin",
    DATABASE_URL: "private",
    MANAGED_AGENT_TOKEN: "private",
    COMPOSIO_API_KEY: "private",
    CPK_TELEMETRY_ID: "private",
    DO_NOT_TRACK: "0",
  });
  expect(env.HOME).toBe("/tmp/fixture-home");
  expect(env.DATABASE_URL).toBeUndefined();
  expect(env.MANAGED_AGENT_TOKEN).toBeUndefined();
  expect(env.COMPOSIO_API_KEY).toBeUndefined();
  expect(env.CPK_TELEMETRY_ID).toBeUndefined();
  expect(env.DO_NOT_TRACK).toBe("1");
});

test("inline images reach ACP as image blocks and unsupported providers fail explicitly", () => {
  const imageInput = {
    ...input,
    messages: [
      {
        id: "image",
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "data" as const,
              value: "aGVsbG8=",
              mimeType: "image/png",
            },
          },
        ],
      },
    ],
  };
  const prompt = acpPrompt(options, imageInput, true);
  expect(prompt.some((block) => block.type === "image")).toBe(true);
  expect(JSON.stringify(prompt[0])).not.toContain("aGVsbG8=");
  expect(() => acpPrompt(options, imageInput, false)).toThrow(
    "does not support image",
  );
});

test("native approval suspension emits an interrupt and stops the CLI without a forged result", async () => {
  const events = await collect(
    new AcpAgent(settings, {
      ...options,
      tools: [
        {
          name: "openduet_probe",
          description: "requires approval",
          parameters: z.object({ text: z.string() }),
          execute: (args, execution) =>
            executeNativeApprovalTool(
              "openduet_probe",
              args,
              execution?.toolCallId,
              undefined,
              async () => {
                throw new HeadlessToolSuspension("Needs approval", {
                  kind: "approval",
                  requestId: "fixture",
                });
              },
            ),
        },
      ],
    }).run(input),
  );
  expect(
    events.some(
      (event) =>
        event.type === EventType.RUN_FINISHED &&
        event.outcome &&
        typeof event.outcome === "object" &&
        "type" in event.outcome &&
        event.outcome.type === "interrupt",
    ),
  ).toBe(true);
  expect(
    events.some((event) => event.type === EventType.TOOL_CALL_RESULT),
  ).toBe(false);
});
