# Local CLI agents through ACP

Set these values in the repository's `.env` (the example defaults to ACP):

```dotenv
OPENBOT_CONVERSATION_STORE=local
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

From the repository root, install Bun 1.4+, PostgreSQL 17 and pgvector (`brew install
postgresql@17 pgvector` on Apple Silicon macOS), then run `bun install --ignore-scripts`
and `bash scripts/start.sh`. The default local launcher creates a private environment file,
starts an isolated PostgreSQL cluster on port 55432, applies migrations, and starts the API,
routine worker, and app. Open http://127.0.0.1:3010. No Docker or Copilot account is required.
`OPENBOT_POSTGRES_BIN` can name another PostgreSQL bin directory. A configured external
`DATABASE_URL` is used as supplied. `bash scripts/stop.sh` stops this install without deleting data.

Computer and browser automation remain optional, separately configured services. To use the
original Compose launcher, set `OPENBOT_DOCKER_START=true`. Its database still supports local
conversation storage. The managed coworker runs in-process through ACP; other remote AG-UI and
Mastra Bots retain their configured endpoints. Chat, routines, handoffs, approvals, tasks,
responsibilities and groups use the same local transcript and agent resolver.

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

Local mode persists owner-scoped transcripts, tool receipts and agent state in PostgreSQL.
The complete transcript survives server restarts; reconnect streams begin with `RUN_STARTED`.
Database leases exclude competing browser and background turns. User input is saved before
calling a CLI, and completion is published only after saving the result. Interrupted turns are
not automatically replayed. Personal memories use the existing local memory tables without
hosted mirroring or entitlement checks.

Hosted Intelligence, licences and automatic hosted Learning are bypassed in local mode. Packaged
skills and application tools remain available. Hosted Learning's automatic skill synthesis is
not supplied by this local replacement. An existing cloud installation can explicitly opt into
`OPENBOT_CONVERSATION_STORE=intelligence`; only that opt-in requires its credentials.

The provider currently creates a new ACP session per run and seeds it with saved history.
Provider session reuse and context compaction remain follow-up work; the complete local transcript
is retained rather than silently truncated.
