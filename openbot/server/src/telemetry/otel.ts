/** External audit export is removed. The local audit trail remains authoritative. */
export type ExportedEvent = {
  eventType: string;
  targetType: string;
  targetId?: string | null;
  actorUserId?: string | null;
  initiatorKind: string;
  initiatorId?: string | null;
  payload: Record<string, unknown>;
  /** Overrides the surface derived from the event type. */
  surface?: string;
};

export type EventExporter = {
  emit: (event: ExportedEvent) => void;
  shutdown: () => Promise<void>;
};

export function otelConfigured(
  _env: Record<string, string | undefined>,
): boolean {
  return false;
}
export function createOtelEventExporter(
  _env: Record<string, string | undefined> = process.env,
): EventExporter | undefined {
  return undefined;
}
