#!/usr/bin/env bash
#
# Start OpenDuet. The platform underneath is OpenBot, in openbot/; this runs its start script with
# this repository's .env. See scripts/env.sh for where that file lives.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/env.sh
if [ "${OPENBOT_CONVERSATION_STORE:-local}" = "local" ] && [ "${OPENBOT_DOCKER_START:-false}" != "true" ]; then
  if [ -f .env ] || [ -f openbot/.env ]; then
    link_env
  fi
  if [ ! -d openbot/node_modules ]; then
    bun install --ignore-scripts --cwd openbot
  fi
  exec bun scripts/local.ts "$@"
fi
link_env
if [ ! -d openbot/node_modules ]; then
  bun install --ignore-scripts --cwd openbot
fi
exec bash openbot/scripts/start.sh "$@"
