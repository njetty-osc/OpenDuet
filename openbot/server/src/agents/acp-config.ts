export type AcpSettings = {
  acpProvider: "codex" | "claude" | "kiro";
  acpCommand?: string;
  acpArgs: string[];
  acpModel?: string;
  acpTimeoutMs: number;
  managedEndpoint?: string;
};

export function acpSettings(
  env: Record<string, string | undefined> = process.env,
): AcpSettings | undefined {
  const mode = env.OPENBOT_AGENT_MODE?.trim() || "api";
  if (mode === "api") return undefined;
  if (mode !== "acp") throw new Error("OPENBOT_AGENT_MODE must be api or acp");
  const provider = env.OPENBOT_ACP_PROVIDER?.trim() || "codex";
  if (provider !== "codex" && provider !== "claude" && provider !== "kiro")
    throw new Error("OPENBOT_ACP_PROVIDER must be codex, claude, or kiro");
  const args: unknown = JSON.parse(env.OPENBOT_ACP_ARGS || "[]");
  if (
    !Array.isArray(args) ||
    !args.every((arg): arg is string => typeof arg === "string")
  )
    throw new Error("OPENBOT_ACP_ARGS must be a JSON array of strings");
  const timeout = Number(env.OPENBOT_ACP_TIMEOUT_MS || "300000");
  if (!Number.isSafeInteger(timeout) || timeout < 1)
    throw new Error("OPENBOT_ACP_TIMEOUT_MS must be a positive integer");
  return {
    acpProvider: provider,
    acpArgs: args,
    acpCommand: env.OPENBOT_ACP_COMMAND?.trim() || undefined,
    acpModel: env.OPENBOT_ACP_MODEL?.trim() || undefined,
    acpTimeoutMs: timeout,
    managedEndpoint:
      env.MANAGED_AGENT_AG_UI_URL?.trim() || "http://localhost:4202/ag-ui",
  };
}
