import { expect, test } from "bun:test";
import { createOtelEventExporter, otelConfigured } from "../src/telemetry/otel";
test("audit telemetry is removed even with a collector configured", () => {
  const env = {
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://collector.example/v1/logs",
    OPENBOT_OTEL_EXPORT: "on",
  };
  expect(otelConfigured(env)).toBe(false);
  expect(createOtelEventExporter(env)).toBeUndefined();
});
