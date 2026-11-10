# Desktop telemetry removed

This fork collects and sends no desktop analytics. The installation identity, persistent queue,
state file, HTTP sender, probe, and validation script have been removed. Legacy setup event types
remain solely for IPC compatibility; dispatch hooks do nothing. See [privacy details](../../docs/telemetry.md).
