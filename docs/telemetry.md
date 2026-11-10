# Privacy in this fork

The desktop installation identity, telemetry state file, persistent event queue, collector,
HTTP sender, probe, and validation script have been removed. Setup events do not leave the UI.
Compatibility IPC types remain so setup and local progress reporting continue to work.

The server disables CopilotKit and Mastra analytics before runtime imports, removes telemetry
identity and product metadata, and forces `DO_NOT_TRACK=1`, `COPILOTKIT_TELEMETRY_DISABLED=true`,
and a zero sampling rate even when inherited environment settings try to enable tracking.
Better Auth is configured with telemetry disabled. App builds compile the same vendor opt-outs
into their browser bundles. Container services disable vendor analytics and optional framework
tracing. Dependency installation should use `bun install --ignore-scripts` when installing vendor
packages in a separately managed environment; the repository does not need vendor install hooks.

The OTLP audit exporter and its direct OpenTelemetry dependencies have been removed. Configuring
an OTLP endpoint no longer exports events. PostgreSQL audit records and local action recording remain.
Third-party dependencies may still contain dormant analytics code; their supported opt-outs are
forced rather than modifying upstream packages in node_modules.

Conversations and memory use the configured PostgreSQL database in the default local mode.
No CopilotKit account or hosted service is needed. Inference uses the logged-in ACP CLI,
which still communicates with its provider, or an explicitly selected model API. Connected services, browser actions, and user-configured
remote Bots still contact their respective endpoints as part of their functionality. Removing
analytics does not make those functional services local. See [ACP setup](acp.md).
