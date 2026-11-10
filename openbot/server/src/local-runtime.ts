import {
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { Hono } from "hono";
import { z } from "zod";
import type { DeploymentConfig } from "./config";
import {
  ConversationError,
  localConversationsStore,
} from "./local-conversations";
import type { ActorAgentResolver } from "./agents/agent-resolver";
import type { IdentifyActor, IdentifyUser } from "./copilot";
import { createRequestAgents } from "./copilot";

/** Authenticated REST history plus request-scoped SSE; no hosted client or license checks. */
export function localRuntimeHandler(
  config: DeploymentConfig,
  resolver: ActorAgentResolver,
  identifyUser: IdentifyUser,
  identifyActor: IdentifyActor,
  basePath: string,
  onBusy?: (input: {
    threadId: string;
    runId: string;
    busy: boolean;
  }) => void | Promise<void>,
) {
  const store = localConversationsStore();
  const app = new Hono();
  app.all(`${basePath}/*`, async (context) => {
    const request = context.req.raw;
    const owner = (await identifyUser(request)).id;
    const url = new URL(request.url);
    const resource = url.pathname.slice(basePath.length);
    try {
      if (resource === "/threads" && request.method === "GET") {
        const rows = await store.list(
          owner,
          url.searchParams.get("agentId") ?? undefined,
          url.searchParams.get("includeArchived") === "true",
        );
        const limit = z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .parse(url.searchParams.get("limit") ?? 20);
        const cursor = url.searchParams.get("cursor");
        const start = cursor
          ? rows.findIndex((row) => row.id === cursor) + 1
          : 0;
        const page = rows.slice(start, start + limit);
        return context.json({
          threads: page.map(
            ({
              messages: _messages,
              state: _state,
              runId: _run,
              leaseUntil: _lease,
              ownerUserId,
              ...row
            }) => ({
              ...row,
              createdById: ownerUserId,
              organizationId: "local",
            }),
          ),
          nextCursor: start + limit < rows.length ? page.at(-1)?.id : null,
        });
      }
      if (resource === "/threads" && request.method === "POST") {
        const body = z
          .object({
            threadId: z.string().min(1).max(200),
            agentId: z.string().min(1),
            name: z.string().max(200).optional(),
          })
          .parse(await request.json());
        await resolver.resolveAgentForActor(
          await identifyActor(request),
          body.agentId,
        );
        const result = await store.ensure({ ...body, userId: owner });
        return context.json(result.thread);
      }
      const match = /^\/threads\/([^/]+)(?:\/(messages|state|archive))?$/.exec(
        resource,
      );
      if (match) {
        const id = decodeURIComponent(match[1]);
        const row = await store.get(owner, id);
        if (request.method === "GET" && match[2] === "messages")
          return context.json(
            await store.client.getThreadMessages({
              userId: owner,
              threadId: id,
            }),
          );
        if (request.method === "GET" && match[2] === "state")
          return context.json({ state: row.state });
        if (request.method === "GET")
          return context.json(
            await store.client.getThread({ userId: owner, threadId: id }),
          );
        if (request.method === "PATCH" && !match[2]) {
          const values = z
            .object({
              name: z.string().trim().min(1).max(200).optional(),
              archived: z.boolean().optional(),
            })
            .parse(await request.json());
          return context.json(await store.patch(owner, id, values));
        }
        if (request.method === "POST" && match[2] === "archive") {
          await store.patch(owner, id, { archived: true });
          return context.json({ threadId: id, archived: true });
        }
        // Deletion is intentionally not supported; retain transcripts.
        return context.json(
          { error: "Conversation operation is not supported." },
          405,
        );
      }
      const runtime = new CopilotRuntime({
        identifyUser,
        agents: createRequestAgents(identifyActor, resolver) as never,
        runner: store.runner(owner, onBusy),
        telemetryProperties: {},
        ...(config.generativeUi ? { openGenerativeUI: true } : {}),
        a2ui: { enabled: config.generativeUi },
      });
      const response = await createCopilotHonoHandler({
        runtime,
        basePath,
      }).fetch(request);
      if (resource === "/info" && response.ok) {
        const info = (await response.json()) as Record<string, unknown>;
        return context.json({
          ...info,
          threadEndpoints: {
            list: true,
            inspect: true,
            mutations: true,
            realtimeMetadata: false,
          },
        });
      }
      return response;
    } catch (error) {
      if (error instanceof ConversationError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (error instanceof z.ZodError)
        return context.json({ error: "Invalid conversation request." }, 400);
      throw error;
    }
  });
  return app;
}
