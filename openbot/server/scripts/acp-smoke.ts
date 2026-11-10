import "../src/telemetry";
import { AcpAgent } from "../src/agents/acp-agent";
import { acpSettings } from "../src/agents/acp-config";
import { EventType } from "@ag-ui/core";
import { z } from "zod";

const settings = acpSettings({ ...process.env, OPENBOT_AGENT_MODE: "acp" });
if (!settings) throw new Error("ACP configuration missing");
let calls = 0;
let failed = false;
let finished = false;
const agent = new AcpAgent(settings, {
  agentId: "smoke",
  model: "default",
  maxSteps: 2,
  prompt:
    "Call openduet_probe exactly once with text=ACP_OK. Then respond ACP_OK. Use only the application MCP tool.",
  tools: [
    {
      name: "openduet_probe",
      description: "Verify application tool routing",
      parameters: z.object({ text: z.literal("ACP_OK") }),
      execute: async () => {
        calls++;
        return "ACP_OK";
      },
    },
  ],
});
await new Promise<void>((resolve, reject) => {
  agent
    .run({
      threadId: "acp-smoke",
      runId: crypto.randomUUID(),
      messages: [
        { id: "user", role: "user", content: "Run the probe as instructed." },
      ],
      tools: [],
      state: {},
      context: [],
      forwardedProps: {},
    })
    .subscribe({
      next(event) {
        if (event.type === EventType.RUN_ERROR) {
          failed = true;
          console.error(event.message);
        }
        if (event.type === EventType.RUN_FINISHED) finished = true;
      },
      error: reject,
      complete: resolve,
    });
});
if (failed || !finished || calls !== 1)
  throw new Error(`ACP smoke failed: calls=${calls}, finished=${finished}`);
console.log(
  `ACP ${settings.acpProvider}: authenticated CLI, MCP tool execution, and completed response verified.`,
);
