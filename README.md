<div align="center">

# OpenDuet

### An open-source proactive agent that gets your work done and keeps you in the loop

Built on [OpenBot](https://github.com/CopilotKit/openbot) and [CopilotKit](https://docs.copilotkit.ai) · [Quick start](#quick-start) · [Overview](#overview) · [Features and Capabilities](#features-and-capabilities) · [How it works](#how-it-works) · [Contributing](#contributing)

[![Built on OpenBot](https://img.shields.io/badge/built%20on-OpenBot-6430AB)](https://github.com/CopilotKit/openbot)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Status: early development](https://img.shields.io/badge/status-early%20development-orange.svg)

<a href="https://trendshift.io/repositories/321847" target="_blank"><img src="https://trendshift.io/api/badge/trendshift/repositories/321847/daily?language=TypeScript" alt="#3 TypeScript Repository Of The Day on Trendshift" width="250" height="55"/></a>

 **Each agent has a computer of its own. Use it on the web, on mobile, in Slack, or in Microsoft Teams.**

Host OpenDuet yourself and choose your own model. The local ACP mode stores conversations and memory in PostgreSQL and uses your existing Codex, Claude Code or Kiro CLI login. No CopilotKit key is needed. Everything that makes it OpenDuet lives in [one folder](#make-it-your-own), so copy it and make it your own.

**OpenDuet is now available as a UX skin in [OpenBot](https://github.com/CopilotKit/OpenBot)**, a more robust version with sign-in, per-Bot permissions and an audit trail, maintained by CopilotKit. This repo stays a community-maintained starter for building your own project.

<a href="https://github.com/CopilotKit/OpenBot"><img src="docs/images/openbot-openduet-skin.png" alt="OpenBot running the OpenDuet skin" width="720"></a><br>
<sub>OpenBot with the OpenDuet skin, picked under Settings → Skin</sub>

[**Bringing OpenDuet to your company? Talk to us about OpenBot →**](https://www.copilotkit.ai/talk-to-an-engineer?ref=openduet_readme)

</div>

---

<div align="center">

<table><tr><td>

https://github.com/user-attachments/assets/f3439f74-855e-4d95-bb5c-713fded3c66e

</td></tr></table>

Setting it up takes a minute: onboarding ends on a checklist of what OpenDuet depends on.

<table><tr><td>

https://github.com/user-attachments/assets/55b74b87-708e-4e69-af1e-16e4071ead95

</td></tr></table>

</div>

## OpenDuet and OpenBot

OpenDuet runs on [OpenBot](https://github.com/CopilotKit/OpenBot), CopilotKit's open-source agent platform, and ships inside it as a skin alongside [OpenDots](https://github.com/CopilotKit/OpenDots) and [OpenMuse](https://github.com/CopilotKit/openmuse). Pick it there and you get OpenDuet's look, with everything OpenBot does underneath.

| If you want to | Start here |
| --- | --- |
| Try OpenDuet, or make it your own | This repo: [Quick start](#quick-start) |
| Run it for your team, with sign-in, per-Bot permissions and an audit trail | [OpenBot](https://github.com/CopilotKit/OpenBot#quick-start), then **Settings → Skin → OpenDuet** |
| Have us stand it up inside your company | [Talk to an engineer](https://www.copilotkit.ai/talk-to-an-engineer?ref=openduet_readme_openbot) |

OpenDots, OpenMuse and OpenDuet are community maintained, and issues and pull requests are welcome in each repo. OpenBot is the one the CopilotKit team maintains and ships fixes to.

## Overview

OpenDuet does not wait to be asked. It starts your day with a short brief, keeps working on a computer of its own while you step away, and comes back only when something needs you. Before it sends, pays, signs, or deletes anything, it shows you exactly what it is about to do and waits for your answer.

**Early.** OpenDuet runs today as [OpenBot](https://github.com/CopilotKit/openbot), CopilotKit's open-source, self-hosted agent platform, with OpenDuet's name, Bots and skills on top. It already reads your Gmail and calendar, sorts what needs you from what can wait, and makes the morning brief. [Features and Capabilities](#features-and-capabilities) lists what works today. Expect things to move. Issues and ideas are welcome.

## What it does

- **A morning brief.** One short message to start the day: what is on, what changed, and what needs a decision from you.
- **What needs you, and what can wait.** It looks across your mail, calendar, and Slack, brings the few things that need you to the top, and holds the rest until they matter.
- **Keeps working when you step away.** Hand it a task and it carries on in a computer of its own: a real browser, its own files, and only the tools you grant. It tells you when it is done, or when it is stuck.
- **Asks before it acts.** Sending a message, making a payment, signing a document, deleting anything: it shows you the exact action and waits. Allow once, always allow, or refuse.
- **Never sees your passwords.** When a site needs a login, you type it into a masked box. The password reaches the site, never the conversation the agent reads.
- **Checks what leaves.** Every outgoing message is checked for sensitive information, so a card number or a health detail does not go out by accident.
- **Yours to run.** Self-host it, choose your own model, and keep your data in your own database.

See [Features and Capabilities](#features-and-capabilities) for what works today.

<p align="center">
  <img src="docs/images/openduet-screens.png" alt="Five OpenDuet screens on a phone: Chat with the morning brief, Tasks, Make with the pages it made, the side panel listing channels, and a suggested task being swiped right to start it." width="880">
</p>

## Features and Capabilities

Everything below works today when you run this repository.

| Capability                   | What it means for you                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| A computer of its own        | Keeps working in its own browser, `/workspace`, and shell while you are away. |
| Asks before it acts          | A reviewer checks every action that changes something, and the ones that matter pause for **Refuse**, **Allow once**, or **Always allow**. A message to other people always asks, once, showing who it goes to and what it says. Anything you type while it carries an action out waits its turn and is answered after. Every action is checked against policy and recorded. |
| Never sees your passwords    | Logins go through a masked secret box. Saved credentials are encrypted and write-only. |
| Memory                       | Threads and memory persist in the local PostgreSQL database. |
| Skills                       | Reusable instructions you write once and call with `/`. |
| Gmail and Google Calendar    | Each person connects their own account. OpenDuet reads mail and today's calendar, and sends a reply only after you answer. |
| Connected apps               | Governed MCP connectors, including Google Drive and Notion. |
| Public-web research          | Search public sources, read selected pages and make a brief with source links after an administrator grants the research tools. [Set up a research provider](openbot/docs/web-research.md). |
| Scheduled work               | Routines: ask it to do something on a schedule and it runs as you. |
| Make it your own             | Its name, Bots, channels, model, and skills live in one folder, [`openbot/examples/openduet`](openbot/examples/openduet). |
| What needs you, what can wait | Sorts new mail into what needs you and what can wait, with a one-line reason for each. Measured on a labelled set in [`evals/triage`](evals/triage). |
| Morning brief                | The first time you open Chat each day after your first, it is already there: what needs you and why, what can wait, today's calendar, and anything it could not check, posted once a day however many tabs or devices you open. You can also ask for it any time. **Start** on a row that needs you hands that email to OpenDuet. |
| Tasks                        | One tab for what needs you, answered right there, what OpenDuet suggests from its background research, and what it is working on. Its newest suggestion also waits above Chat's composer, with **Start** and **Hide**. A suggestion you start stays in view: under **Working** while OpenDuet works, then **Ready for review** or **Needs input** with OpenDuet's next step, opening at its own message. Answer it in Chat, on its card or by deciding its approval, and it goes back to **Working** until OpenDuet replies. A run that fails says why, with **Try again** where running it again can help. Check one off and it folds into **Resolved**. |
| Setup checklist              | Onboarding asks you to connect Gmail and Calendar and to turn on notifications, each with **Not now**, then ends on a list of what OpenDuet depends on: local storage, the ACP CLI, Google, your Gmail and Calendar, notifications, and the optional extras. Each is **Ready**, **Not checked** or **Needs setup**, from the real answer, with how to fix it. **Check again** refreshes the configured services. **Settings → Setup** opens it again. |
| Gets to know you             | On your first day it speaks first: it greets you, reads your recent mail and this week's calendar, then answers in three short bubbles (who you are, three ways it can help, and an invitation to correct it), with **Sounds right** and **Something's off** to tap. With Gmail and Calendar not connected, it promises no mail: it says what it can do now and shows the card to connect them. |
| Make                         | Ask for a design system, a design, a dashboard, slides, a doc or a web page, or pick one from the **+** on the Make tab, and OpenDuet makes it. A card in Chat opens it, and Make keeps everything it made as thumbnails you can filter by kind. |
| Channels                     | Make a channel for a piece of work: a name, an icon in a colour, and what it is for. OpenDuet says hello there and offers three things it could start on, keeps the work there about that purpose, and the tasks it starts there wear the channel's colour. Everything stays your one thread, and the menu lists your channels with Archived folded under them. |
| Answers in a tap             | When it asks you to choose, the likely answers appear as replies you can tap. |
| Light or dark                | Follows your phone's setting, changing with it, or pick Light or Dark in Settings. |
| Say it instead               | Tap the voice button in Chat and say everything you need to do. It is written down and sent as your message. Needs a speech-to-text provider on the server (`TRANSCRIPTION_*`). |

## Quick start

You need [Bun](https://bun.sh) 1.4 or newer, PostgreSQL with pgvector, and a logged-in
Codex, Claude Code or Kiro CLI. No CopilotKit account, model API key, or Docker is needed for chat.

Run from the repository root:

```sh
brew install postgresql@17 pgvector
bun install --ignore-scripts
bash scripts/start.sh
```

Open <http://127.0.0.1:3010>. The launcher creates a private local environment, starts PostgreSQL
on port 55432, applies migrations, and runs the API, routine worker and app. Conversations, memory,
tasks, approvals and settings persist locally. `bash scripts/stop.sh` stops this install and retains
your data. Select `OPENBOT_ACP_PROVIDER=claude` or `kiro` in `openbot/.env` before restarting to
change the CLI; the default is Codex. [ACP setup and limits](docs/acp.md).

Computer automation, connected apps, voice and external Bots need their own optional services.
The original Docker launcher is available with `OPENBOT_DOCKER_START=true`. Hosted Intelligence
is an explicit compatibility option with `OPENBOT_CONVERSATION_STORE=intelligence`, rather
than a requirement of local ACP mode.

To run a second install beside another on one machine, give it its own `COMPOSE_PROJECT_NAME`, `COMPUTER_NAMESPACE`, image tags (`COMPUTER_IMAGE` and the other `*_IMAGE` settings), and a value for every `*_PORT`. Change the addresses built from those ports to match: `DATABASE_URL`, `AGENT_COMPUTER_URL`, `MANAGED_AGENT_AG_UI_URL`, `OPENBOT_PUBLIC_URL` and `TRUSTED_ORIGINS`. If both use the same Intelligence project, give it its own `DEPLOYMENT_ID` too. [openbot/docs/configuration.md](openbot/docs/configuration.md#ports) lists them. Two installs can instead share one computer, if they use the same token.

To diagnose a 401, inspect container names and port mappings with `docker ps`, then compare `COMPUTER_TOKEN` by equality without printing either value. The setup checklist authenticates against the provider and checks network-policy delivery; a configured URL alone no longer means Ready. A sleeping computer reads Not checked until it is running and **Check again** succeeds.

This fork removes desktop telemetry and external audit export, and disables vendor runtime analytics. [Privacy details](docs/telemetry.md). [Local ACP setup](docs/acp.md).

Once it is running, try the parts that work today:

- Ask the OpenDuet Bot to do something in its own browser, and watch it work on its computer.
- Choose what it must ask you about first in `/settings/approvals`.
- Ask it to do something on a schedule. You will find it in `/routines`.

Sign-in for a team, and Slack and Teams, are OpenBot's: see [openbot/docs](openbot/docs/README.md). A hosted or deploy guide for OpenDuet is not published yet, and neither is an OpenDuet image, so the Quick start above is the supported way to run it today. The Docker and Helm guides in `openbot/docs` deploy plain OpenBot from OpenBot's own image, not OpenDuet.

### Connect Gmail and Google Calendar

Gmail and Calendar need a Google OAuth client, which an administrator registers once. Each person then connects their own account under **Connections**. With the default `.env` you are the administrator. **Settings → Setup** in the app shows which of these steps is still open and links to each page. [openbot/docs/plugins/google-workspace.md](openbot/docs/plugins/google-workspace.md) has the Google Cloud steps: the two APIs to enable, the consent screen, and the OAuth client.

Connecting needs `OPENBOT_PUBLIC_URL`, the API's address that Google sends people back to. `.env.example` sets it to `http://localhost:3001`, so it has to change if you move `SERVER_PORT`, and it must be the public address once deployed.

To try it without a Google account, use the fake Google that ships for tests and demos. Setting its URL is not enough on its own. The steps are:

1. Start the fake Google. It serves an invented inbox and calendar.

   ```sh
   bun openbot/scripts/fake-google/server.ts --port 4900
   ```

2. In `.env`, set `OPENDUET_FAKE_GOOGLE_URL=http://127.0.0.1:4900`, then start OpenDuet. If it is already running, run `bash scripts/stop.sh` and `bash scripts/start.sh`, because the API reads `.env` only when it starts.
3. Open `/admin/plugins/google-workspace`. Turn on **Enable for this deployment**, open **OAuth client** and paste any client ID and secret (the fake accepts anything), then press **Refresh tools**.
4. Grant the connector's tools to the OpenDuet Bot at `/admin/plugins/google-workspace/bots/openduet`.
5. Open `/connections/google-workspace` and press **Connect**. The fake consents at once, as `maya@marlowceramics.com`, and sends you straight back.

`OPENBOT_PUBLIC_URL` has to match the API's port, because the fake sends you back through it. `curl http://127.0.0.1:4900/__fake/sent` shows anything OpenDuet sent. The variable is ignored when `NODE_ENV=production`. To switch to real Google, remove it, restart, and connect again: the stored sign-in belongs to the fake.

### Search the public web

The OpenDuet Bot ships with a public-web research skill. [Set up a research provider](openbot/docs/web-research.md) to let it find sources and read pages without using its browser. The catalogue includes Parallel, Exa and Firecrawl. An administrator enables a connector and grants its search and fetch tools after reviewing the guide's controls and data-sharing risks.

Then try `/research-public-web` with a request such as “Compare three public project-management tools for a small team, check their current pricing, and make a brief with source links.”

## Make it your own

OpenDuet is meant to be copied. Everything that makes it OpenDuet rather than OpenBot is in [`openbot/examples/openduet`](openbot/examples/openduet):

| File            | What it decides                                                       |
| --------------- | --------------------------------------------------------------------- |
| `brand.yaml`    | The product's name, everywhere in the app.                            |
| `agents.yaml`   | The Bots, their instructions, and which skills each one holds.        |
| `channels.yaml` | The conversations people see, and which Bots answer in each.          |
| `model.yaml`    | The model provider and default model.                                 |
| `skills.yaml`   | Instructions anyone can call with `/`, and the tools each one needs.  |

Copy the folder, change it, and point `TENANT_PACKAGE_DIR` in `.env` at your copy (relative to `openbot/server`). OpenBot's code underneath stays as it is in `openbot/`, so OpenBot's fixes can still be brought in.

## What is in this repository

| Path                  | What it is                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `openbot/`            | The platform OpenDuet runs on: [OpenBot](https://github.com/CopilotKit/openbot)'s server, app, worker, each Bot's computer, Docker and Helm files. |
| `openbot/examples/openduet` | OpenDuet's tenant package: its name, Bots, channels, model and skills.                       |
| `scripts/`            | `start.sh` and `stop.sh`, which run OpenBot's scripts with this repository's `.env`.               |
| `docs/`               | ACP setup and privacy behavior. OpenBot's own documentation is in `openbot/docs`. |
| `assets/`             | The banner.                                                                                        |

## Built on OpenBot

<p align="center">
  <a href="https://www.copilotkit.ai/openbot"><img src="docs/images/openbot.png" alt="OpenBot" width="560"></a>
</p>

OpenDuet is built on top of [OpenBot](https://github.com/CopilotKit/openbot), CopilotKit's open-source, self-hosted agent platform. OpenBot provides the server, the app, each Bot's computer, the approval boundary, the audit trail, sign-in, and the Slack and Teams channels. OpenDuet adds the morning brief, Tasks, Make and its own Bots and skills on top; its name, Bots and skills live in one folder, [`openbot/examples/openduet`](openbot/examples/openduet). To build a different assistant on the same foundation, start from [OpenBot](https://github.com/CopilotKit/openbot), or read more at [copilotkit.ai/openbot](https://www.copilotkit.ai/openbot).

## How it works

Everything below works in this repository today.

```text
You: web · Slack / Microsoft Teams
        │                             ▲
        │ asks, answers, approvals    │ morning brief, "this needs you"
        ▼                             │
OpenDuet server   (OpenBot: Hono + CopilotKit runtime)
  ├── triage          what needs you / what can wait
  ├── approvals       Allow once · Always allow · Refuse
  └── gateway         policy → audit record → act
        │ AG-UI
        ▼
Agent   (any AG-UI agent, on a framework or hand-written)
        │ every tool call comes back through the gateway
        ▼
Its own computer   Chromium · /workspace · shell

Local PostgreSQL         threads and memory
PostgreSQL + pgvector     policy, approvals, audit, encrypted credentials
MCP connectors            Google Drive, Notion, and more through Composio
```

**Channels.** You reach OpenDuet where you already are: the web app, Slack, or Microsoft Teams, all of which OpenBot supports today.

**Server.** OpenBot's server hosts the CopilotKit runtime and sends each turn to the agent over [AG-UI](https://github.com/ag-ui-protocol/ag-ui). OpenDuet adds two pieces in front of it: a triage step that decides what needs you and what can wait, and a morning brief built from it. Both build on OpenBot's routines, which give an agent scheduled turns that run as you.

**Agent.** Any endpoint that speaks AG-UI can be the agent, whether it is built with LangGraph, Mastra, CrewAI, Pydantic AI, Google ADK, or written by hand. OpenDuet is not tied to one framework or one model.

**Its own computer.** Each agent gets a container of its own, with Chromium, a `/workspace` volume, a browser profile, and a shell. That is where it keeps working while you step away. When it hits a login wall or a two-factor prompt, it asks for help and you can take the wheel.

**Approvals.** Every action the agent takes goes through one gateway. The gateway checks the action against your policy, writes an audit record, and only then acts. Actions set to ask pause and show you the exact action and the rule that asked, with **Allow once**, **Always allow**, and **Refuse**. Deny rules refuse an action outright. OpenDuet's defaults will ask before anything that sends, pays, signs, or deletes.

**Passwords and credentials.** When a site needs a secret, the agent asks for it through a masked box. The value goes to the site; the transcript records only that a secret was requested. Credentials you store are encrypted at rest, write-only, never returned by an API, and redacted from audit events.

**What leaves.** OpenBot treats any tool it cannot positively classify as a read as a write, and redacts secrets from its audit trail. A message to other people always asks first, showing who it goes to and what it says.

**Memory.** Threads and memory live in this install's PostgreSQL database, so conversations survive restarts and what it has learned about you carries over. You can see what it remembers about you, and tell it facts directly.

**Skills and connectors.** Skills are instructions you write once and call with `/`. Connected apps are governed MCP servers: Google Drive and Notion ship in OpenBot's catalogue, and Composio brokers more. A connector is granted to an agent before it can be used.

## Contributing

OpenDuet is early, so please open an issue before starting substantial work. Much of the foundation lives in [OpenBot](https://github.com/CopilotKit/openbot): changes to the computer, the gateway, approvals, credentials, or connectors usually belong there.

## About

OpenDuet was built by [CopilotKit](https://www.copilotkit.ai) and is community maintained. CopilotKit is the team behind [OpenBot](https://github.com/CopilotKit/openbot) and the [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui).

It is CopilotKit's open-source take on the proactive-agent category: assistants that reach out first, such as Claude Duet. OpenDuet is an independent project and is not affiliated with or endorsed by Anthropic.

**Rolling it out at your company?** [Talk to a CopilotKit engineer.](https://www.copilotkit.ai/talk-to-an-engineer?ref=openduet_readme)

- [copilotkit.ai/openduet](https://www.copilotkit.ai/openduet): OpenDuet's page
- [Discord](https://discord.gg/6dffbvGU3D): ask a question or share what you are building
- [@copilotkit on X](https://x.com/copilotkit): releases and what is shipping
- [docs.copilotkit.ai](https://docs.copilotkit.ai): CopilotKit documentation

## License

[MIT](./LICENSE) © CopilotKit
