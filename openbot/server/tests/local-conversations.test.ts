import "../src/telemetry";
import { randomUUID } from "node:crypto";
import {
  AbstractAgent,
  EventType,
  HttpAgent,
  type BaseEvent,
  type RunAgentInput,
} from "@ag-ui/client";
import { afterAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { Observable, from } from "rxjs";
import { createDatabase } from "../src/db/client";
import { localConversations } from "../src/db/schema/local-conversations";
import {
  LocalConversations,
  configureLocalConversations,
} from "../src/local-conversations";
import { localRuntimeHandler } from "../src/local-runtime";
import { loadConfig } from "../src/config";
import { acpSettings } from "../src/agents/acp-config";
import { AcpAgent } from "../src/agents/acp-agent";
import type { ActorAgentResolver } from "../src/agents/agent-resolver";
import { z } from "zod";
import { testDatabaseUrlFrom } from "./support/database";

const address = process.env.TEST_DATABASE_URL
  ? testDatabaseUrlFrom(process.env)
  : undefined;
const suite = address ? describe : describe.skip;
suite("local durable conversations", () => {
  const database = createDatabase(
    address ?? "postgres://localhost/openbot_test",
  );
  const owner = `local-test-${randomUUID()}`;
  const store = new LocalConversations(database);
  class Reply extends AbstractAgent {
    constructor() {
      super({ agentId: "test-bot" });
    }
    run(input: RunAgentInput) {
      return from<BaseEvent[]>([
        {
          type: EventType.RUN_STARTED,
          threadId: input.threadId,
          runId: input.runId,
        },
        {
          type: EventType.TEXT_MESSAGE_START,
          messageId: input.runId,
          role: "assistant",
        },
        {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: input.runId,
          delta: "Saved locally.",
        },
        { type: EventType.TEXT_MESSAGE_END, messageId: input.runId },
        { type: EventType.STATE_SNAPSHOT, snapshot: { remembered: true } },
        {
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        },
      ]);
    }
    clone() {
      return new Reply();
    }
  }
  const input = (threadId: string = randomUUID()): RunAgentInput => ({
    threadId,
    runId: randomUUID(),
    messages: [{ id: randomUUID(), role: "user", content: "Hello" }],
    tools: [],
    context: [],
    state: {},
    forwardedProps: {},
  });
  async function collect(source: Observable<BaseEvent>) {
    const events: BaseEvent[] = [];
    await new Promise<void>((resolve, reject) =>
      source.subscribe({
        next: (event) => events.push(event),
        error: reject,
        complete: resolve,
      }),
    );
    return events;
  }
  afterAll(async () => {
    await store.stop();
    await database
      .delete(localConversations)
      .where(eq(localConversations.ownerUserId, owner));
    await database.$client.close();
  });

  test("persists the full transcript and state before announcing completion", async () => {
    const run = input();
    const events = await collect(
      store
        .runner(owner)
        .run({ threadId: run.threadId, input: run, agent: new Reply() }),
    );
    expect(events[0]?.type).toBe(EventType.RUN_STARTED);
    expect(
      events.filter((event) => event.type === EventType.RUN_STARTED),
    ).toHaveLength(1);
    expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
    const reopened = new LocalConversations(database);
    const saved = await reopened.get(owner, run.threadId);
    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[1]?.content).toBe("Saved locally.");
    expect(saved.state).toEqual({ remembered: true });
    expect(saved.runId).toBeNull();
    // Incomplete browser snapshots cannot erase the earlier turn.
    const second = input(run.threadId);
    await collect(
      store
        .runner(owner)
        .run({ threadId: run.threadId, input: second, agent: new Reply() }),
    );
    expect((await store.get(owner, run.threadId)).messages).toHaveLength(4);
  });

  test("empty and saved history reconnect through the actual AG-UI client", async () => {
    const run = input();
    const runner = store.runner(owner);
    const empty = await collect(runner.connect({ threadId: run.threadId }));
    expect(empty.map((event) => event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.MESSAGES_SNAPSHOT,
      EventType.STATE_SNAPSHOT,
      EventType.RUN_FINISHED,
    ]);
    await collect(
      runner.run({ threadId: run.threadId, input: run, agent: new Reply() }),
    );
    configureLocalConversations(store);
    const actor = { id: owner, role: "admin" as const };
    const resolver = {
      resolveAgentForActor: async () => new Reply(),
      resolveAgentsForActor: async () => ({ "test-bot": new Reply() }),
    } satisfies ActorAgentResolver;
    const handler = localRuntimeHandler(
      loadConfig({
        DATABASE_URL: address,
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        OPENBOT_SINGLE_USER: "true",
      }),
      resolver,
      async () => ({ id: owner, name: "Test" }),
      async () => actor,
      "/api/copilotkit",
    );
    class ReconnectingAgent extends HttpAgent {
      protected connect(input: RunAgentInput) {
        return this.run(input);
      }
    }
    const client = new ReconnectingAgent({
      url: "http://test/api/copilotkit/agent/test-bot/connect",
      threadId: run.threadId,
      fetch: (request, init) =>
        Promise.resolve(handler.fetch(new Request(request, init))),
    });
    await client.connectAgent();
    expect(client.messages).toHaveLength(2);
    expect(client.state).toEqual({ remembered: true });
  });

  test("owners cannot read, take over, or stop another owner's conversation", async () => {
    const run = input();
    await store.ensure({
      threadId: run.threadId,
      userId: owner,
      agentId: "test-bot",
    });
    await expect(store.get("other-user", run.threadId)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      store.ensure({
        threadId: run.threadId,
        userId: "other-user",
        agentId: "test-bot",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await store.list("other-user")).not.toContainEqual(
      expect.objectContaining({ id: run.threadId }),
    );
    expect(
      await store.runner("other-user").stop({ threadId: run.threadId }),
    ).toBe(false);
  });

  test("database leases exclude competing runs across store instances", async () => {
    const run = input();
    const lock = {
      threadId: run.threadId,
      runId: run.runId,
      userId: owner,
      agentId: "test-bot",
    };
    await store.acquire(lock);
    const other = new LocalConversations(database);
    await expect(
      other.acquire({ ...lock, runId: randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
    await store.release({ threadId: run.threadId, runId: "wrong-run" });
    await expect(
      other.acquire({ ...lock, runId: randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
    await store.renew({
      threadId: run.threadId,
      runId: run.runId,
      ttlSeconds: 120,
    });
    await store.release(lock);
    await other.acquire({ ...lock, runId: randomUUID() });
    await database
      .update(localConversations)
      .set({ runId: null, leaseUntil: null })
      .where(eq(localConversations.id, run.threadId));
  });

  test("expired leases recover, while stale renewals cannot revive them", async () => {
    const run = input();
    const lock = {
      threadId: run.threadId,
      runId: run.runId,
      userId: owner,
      agentId: "test-bot",
    };
    await store.acquire(lock);
    await database
      .update(localConversations)
      .set({ leaseUntil: new Date(Date.now() - 1000) })
      .where(eq(localConversations.id, run.threadId));
    await expect(
      store.renew({ ...lock, ttlSeconds: 120 }),
    ).rejects.toMatchObject({ status: 409 });
    const newRun = randomUUID();
    await store.acquire({ ...lock, runId: newRun });
    await store.release(lock);
    expect((await store.get(owner, run.threadId)).runId).toBe(newRun);
    await store.release({ ...lock, runId: newRun });
  });

  test("background work uses the same store and requires an owner-bound lease", async () => {
    const run = input();
    await store.acquire({
      threadId: run.threadId,
      runId: run.runId,
      userId: owner,
      agentId: "test-bot",
    });
    const events = await collect(
      store
        .runner()
        .run({ threadId: run.threadId, input: run, agent: new Reply() }),
    );
    expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
    expect(
      (
        await store.client.getThreadMessages({
          threadId: run.threadId,
          userId: owner,
        })
      ).messages,
    ).toHaveLength(2);
    const unleased = input();
    const refused = await collect(
      store
        .runner()
        .run({
          threadId: unleased.threadId,
          input: unleased,
          agent: new Reply(),
        }),
    );
    expect(refused[0]?.type).toBe(EventType.RUN_STARTED);
    expect(refused.at(-1)?.type).toBe(EventType.RUN_ERROR);
  });

  test("actual ACP tool round trip persists in a background conversation", async () => {
    const settings = acpSettings({
      OPENBOT_AGENT_MODE: "acp",
      OPENBOT_ACP_COMMAND: process.execPath,
      OPENBOT_ACP_ARGS: JSON.stringify([
        new URL("./fixtures/acp-fixture.mjs", import.meta.url).pathname,
      ]),
    })!;
    let calls = 0;
    const agent = new AcpAgent(settings, {
      agentId: "test-bot",
      prompt: "Call openduet_probe.",
      model: "default",
      maxSteps: 3,
      tools: [
        {
          name: "openduet_probe",
          description: "Probe",
          parameters: z.object({ text: z.string() }),
          execute: async () => {
            calls++;
            return "Local tool receipt";
          },
        },
      ],
    });
    const run = input();
    await store.acquire({
      threadId: run.threadId,
      runId: run.runId,
      userId: owner,
      agentId: "test-bot",
    });
    const events = await collect(
      store.runner().run({ threadId: run.threadId, input: run, agent }),
    );
    expect(calls).toBe(1);
    expect(events.some((event) => event.type === EventType.RUN_ERROR)).toBe(
      false,
    );
    expect(
      (await store.get(owner, run.threadId)).messages.some(
        (message) => message.role === "tool",
      ),
    ).toBe(true);
  }, 15_000);

  test("metadata edits and archival preserve messages", async () => {
    const run = input();
    await collect(
      store
        .runner(owner)
        .run({ threadId: run.threadId, input: run, agent: new Reply() }),
    );
    await store.patch(owner, run.threadId, { name: "Keep me", archived: true });
    expect((await store.get(owner, run.threadId)).messages).toHaveLength(2);
    expect(
      (await store.list(owner)).some((row) => row.id === run.threadId),
    ).toBe(false);
    expect(
      (await store.list(owner, undefined, true)).some(
        (row) => row.name === "Keep me",
      ),
    ).toBe(true);
  });

  test("active reconnect, exact-run cancellation, and partial-history retention", async () => {
    let began!: () => void;
    const ready = new Promise<void>((resolve) => {
      began = resolve;
    });
    class Waiting extends Reply {
      run(input: RunAgentInput) {
        return new Observable<BaseEvent>((subscriber) => {
          subscriber.next({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          });
          subscriber.next({
            type: EventType.TEXT_MESSAGE_START,
            messageId: input.runId,
            role: "assistant",
          });
          subscriber.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: input.runId,
            delta: "Partial reply",
          });
          began();
          return () => {};
        });
      }
    }
    const run = input();
    const runner = store.runner(owner);
    const completed = collect(
      runner.run({ threadId: run.threadId, input: run, agent: new Waiting() }),
    );
    await ready;
    expect(
      await store.runner("other-user").stop({ threadId: run.threadId }),
    ).toBe(false);
    expect(
      await runner.stop({ threadId: run.threadId, runId: "old-run" }),
    ).toBe(false);
    expect(await runner.isRunning({ threadId: run.threadId })).toBe(true);
    const replayed: BaseEvent[] = [];
    const replay = runner
      .connect({ threadId: run.threadId })
      .subscribe((event) => replayed.push(event));
    // Admission and replay use the actual database; let the read resolve before stopping.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(replayed[0]?.type).toBe(EventType.RUN_STARTED);
    expect(
      await runner.stop({ threadId: run.threadId, runId: run.runId }),
    ).toBe(true);
    const events = await completed;
    replay.unsubscribe();
    expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
    expect(
      (await store.get(owner, run.threadId)).messages.some(
        (message) => message.content === "Partial reply",
      ),
    ).toBe(true);
    expect(await runner.isRunning({ threadId: run.threadId })).toBe(false);
  });

  test("a provider failure keeps the submitted user message and reports failure", async () => {
    class Failed extends Reply {
      run() {
        return new Observable<BaseEvent>((subscriber) =>
          subscriber.error(new Error("Provider unavailable")),
        );
      }
    }
    const run = input();
    const events = await collect(
      store
        .runner(owner)
        .run({ threadId: run.threadId, input: run, agent: new Failed() }),
    );
    expect(events[0]?.type).toBe(EventType.RUN_STARTED);
    expect(events.at(-1)?.type).toBe(EventType.RUN_ERROR);
    expect((await store.get(owner, run.threadId)).messages[0]?.content).toBe(
      "Hello",
    );
    expect((await store.get(owner, run.threadId)).runId).toBeNull();
  });
});

test("local storage boots without any Copilot or model API key", () => {
  const config = loadConfig({
    DATABASE_URL: "postgres://localhost/openbot",
    KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    OPENBOT_SINGLE_USER: "true",
    OPENBOT_AGENT_MODE: "acp",
  });
  expect(config.runtime).toEqual({ mode: "local", durableHistory: true });
  expect(config.learningAutoAssign).toBe(false);
});
