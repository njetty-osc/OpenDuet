import { expect, test } from "bun:test";
import { desktopTelemetryProperties } from "./desktop-telemetry";
test("desktop metadata is never collected", () => {
  expect(
    desktopTelemetryProperties({
      OPENBOT_DISTRIBUTION: "desktop",
      OPENBOT_VERSION: "1.2.3",
    }),
  ).toEqual({});
});
