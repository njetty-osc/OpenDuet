# Mastra, as a Bot. Bun and Mastra's own server, because Mastra serves its AG-UI route itself
# rather than handing back a handler to mount.
FROM oven/bun:1.4-alpine
ENV DO_NOT_TRACK=1 COPILOTKIT_TELEMETRY_DISABLED=true MASTRA_TELEMETRY_DISABLED=true SCARF_ANALYTICS=false ANONYMIZED_TELEMETRY=false CREWAI_TRACING_ENABLED=false LANGCHAIN_TRACING_V2=false LANGSMITH_TRACING=false

WORKDIR /app
COPY agent-mastra/package.json ./
RUN bun install

COPY shared/listen-port.ts /shared/listen-port.ts
COPY shared/model-providers.ts /shared/model-providers.ts
COPY shared/model-providers.json /shared/model-providers.json
COPY agent-mastra/src ./src

# Built at image time, not at start: `mastra start` runs a bundle, and building on every container
# start would put a build step in front of a person waiting for a Bot.
RUN bunx mastra build --dir src/mastra

ENV PORT=4213
EXPOSE 4213
CMD ["bunx", "mastra", "start"]
