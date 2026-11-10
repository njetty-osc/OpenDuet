// Loaded before vendor runtimes. This fork never sends product analytics.
process.env.DO_NOT_TRACK = "1";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
process.env.COPILOTKIT_TELEMETRY_SAMPLE_RATE = "0";
process.env.MASTRA_TELEMETRY_DISABLED = "true";
process.env.BETTER_AUTH_TELEMETRY_DISABLED = "1";
process.env.SCARF_ANALYTICS = "false";
process.env.OPENBOT_OTEL_EXPORT = "off";
delete process.env.CPK_TELEMETRY_ID;

export function runtimeTelemetryProperties(
  _accessibility: boolean,
): Record<string, never> {
  return {};
}
