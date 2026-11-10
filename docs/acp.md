# Local CLI agents through ACP

Set these values in the repository's `.env` (the example defaults to ACP):

```dotenv
OPENBOT_AGENT_MODE=acp
OPENBOT_ACP_PROVIDER=codex
OPENBOT_ACP_TIMEOUT_MS=300000
```

Log in to the chosen CLI on the machine running the API server. Supported providers are `codex`,
`claude`, and `kiro`. Codex and Claude ACP adapters are pinned dependencies. The CLI must be on the
server's `PATH`; `CODEX_PATH` and `CLAUDE_CODE_EXECUTABLE` can name an executable explicitly. Kiro
uses `kiro-cli acp` with a temporary application agent. No model API key is required for ACP inference.

Optional settings:

| Variable | Purpose |
| --- | --- |
| `OPENBOT_ACP_MODEL` | Provider model selection; unset uses its default. |
| `OPENBOT_ACP_COMMAND` | Custom ACP executable, without shell parsing. |
| `OPENBOT_ACP_ARGS` | JSON array of arguments for the custom executable. |
| `OPENBOT_ACP_TIMEOUT_MS` | Positive timeout in milliseconds, including initialization. |
| `OPENBOT_AGENT_MODE=api` | Use the existing model API transport. |

From the repository root, run `bun install`, then `bash scripts/start.sh`. ACP mode starts the
computer and database services, API, worker, and app; it skips the model API Bot containers. The
managed coworker endpoint identifies which registered remote Bot should run in-process through ACP.
Other remote AG-UI and Mastra Bots retain their explicitly configured endpoints. Built-in Bots use ACP
through the same resolver as chat, routines, and background work.

The provider receives a fresh ACP session per run, seeded from OpenDuet's conversation history,
standing instructions, context, and state. Its MCP server exposes only the run's granted application
tools, which execute through the existing permission, policy, and audit functions. UI tools emit an
AG-UI tool call and end the run for application execution; their real result arrives with the next
run. Stop and timeouts terminate the provider process group and remove the temporary working directory.
Attachments use the existing access-controlled inline loader, with images sent as ACP image blocks. Application credentials are excluded from subprocess environments. No provider stderr is logged.

Claude disables built-in tools and project/local settings; account settings remain available for CLI authentication. Kiro uses an application-only tool configuration.
Codex is launched in its read-only mode and native permission requests are denied. ACP client file
and terminal capabilities are disabled. These are provider controls, not an OS sandbox guaranteeing
that a CLI cannot read its own machine. Run the API under an appropriately scoped account.

## Verify the local provider

```sh
bun openbot/server/scripts/acp-smoke.ts
OPENBOT_ACP_PROVIDER=claude bun openbot/server/scripts/acp-smoke.ts
OPENBOT_ACP_PROVIDER=kiro bun openbot/server/scripts/acp-smoke.ts
```

The probe must call a validated application MCP tool exactly once and complete its response.
It uses the chosen CLI login and does not require a database or CopilotKit key.

## Conversation storage

ACP changes inference, not storage. OpenDuet still requires its configured CopilotKit Intelligence
service and valid project key for durable threads and memory. Its endpoint may be self-hosted;
the upstream default is hosted. A fully local replacement for that service is not included here.
The app itself additionally requires PostgreSQL and a container engine for its computer service.
