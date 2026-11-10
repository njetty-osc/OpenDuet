/** Retained for compatibility; desktop analytics metadata is never collected. */
export function desktopTelemetryProperties(
  _env: Record<string, string | undefined> = process.env,
): Record<string, never> {
  return {};
}
