import { randomUUID } from "node:crypto";
import { EventType, type BaseEvent, type Message } from "@ag-ui/client";
import {
  AgentRunner,
  type AgentRunnerConnectRequest,
  type AgentRunnerIsRunningRequest,
  type AgentRunnerRunRequest,
  type AgentRunnerStopRequest,
  type CopilotKitIntelligence,
  type CreateThreadRequest,
  type ThreadSummary,
  finalizeRunEvents,
} from "@copilotkit/runtime/v2";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { Observable, ReplaySubject, filter } from "rxjs";
import type { Database } from "./db/client";
import { localConversations } from "./db/schema/local-conversations";

type Row = typeof localConversations.$inferSelect;
type Active = {
  owner: string;
  request: AgentRunnerRunRequest;
  events: ReplaySubject<BaseEvent>;
  stopped: boolean;
  done: Promise<void>;
  initialMessages?: Message[];
  initialState?: Record<string, unknown>;
};
type Method<K extends keyof CopilotKitIntelligence> =
  CopilotKitIntelligence[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : never;

export class ConversationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const summary = (row: Row): ThreadSummary => ({
  id: row.id,
  name: row.name,
  agentId: row.agentId,
  createdById: row.ownerUserId,
  organizationId: "local",
  archived: row.archived,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** One durable store and one live-run registry for browser and background work. */
export class LocalConversations {
  private readonly active = new Map<string, Active>();
  constructor(readonly database: Database) {}

  async get(userId: string, threadId: string): Promise<Row> {
    const [row] = await this.database
      .select()
      .from(localConversations)
      .where(
        and(
          eq(localConversations.id, threadId),
          eq(localConversations.ownerUserId, userId),
        ),
      );
    if (!row) throw new ConversationError("Conversation not found.", 404);
    return row;
  }

  async ensure(input: CreateThreadRequest) {
    if (
      !input.threadId ||
      input.threadId.length > 200 ||
      !input.userId ||
      !input.agentId
    )
      throw new ConversationError("Invalid conversation identity.", 400);
    const inserted = await this.database
      .insert(localConversations)
      .values({
        id: input.threadId,
        ownerUserId: input.userId,
        agentId: input.agentId,
        name: input.name ?? null,
      })
      .onConflictDoNothing()
      .returning();
    const row = await this.get(input.userId, input.threadId);
    if (row.agentId !== input.agentId)
      throw new ConversationError(
        "This conversation belongs to another Bot.",
        409,
      );
    return { thread: summary(row), created: inserted.length > 0 };
  }

  async list(userId: string, agentId?: string, includeArchived = false) {
    return this.database
      .select()
      .from(localConversations)
      .where(
        and(
          eq(localConversations.ownerUserId, userId),
          ...(agentId ? [eq(localConversations.agentId, agentId)] : []),
          ...(!includeArchived ? [eq(localConversations.archived, false)] : []),
        ),
      )
      .orderBy(desc(localConversations.updatedAt), desc(localConversations.id));
  }

  async patch(
    userId: string,
    threadId: string,
    values: { name?: string; archived?: boolean },
  ) {
    const [row] = await this.database
      .update(localConversations)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(localConversations.id, threadId),
          eq(localConversations.ownerUserId, userId),
        ),
      )
      .returning();
    if (!row) throw new ConversationError("Conversation not found.", 404);
    return summary(row);
  }

  /** Conditional UPDATE makes browser, routine, and handoff admission atomic across processes. */
  async acquire(input: {
    threadId: string;
    userId: string;
    agentId: string;
    runId: string;
    ttlSeconds?: number;
  }) {
    await this.ensure(input);
    const now = new Date();
    const [row] = await this.database
      .update(localConversations)
      .set({
        runId: input.runId,
        leaseUntil: new Date(now.getTime() + (input.ttlSeconds ?? 120) * 1000),
      })
      .where(
        and(
          eq(localConversations.id, input.threadId),
          eq(localConversations.ownerUserId, input.userId),
          or(
            isNull(localConversations.runId),
            lt(localConversations.leaseUntil, now),
          ),
        ),
      )
      .returning();
    if (!row)
      throw new ConversationError("Conversation is already running.", 409);
    return { threadId: input.threadId, runId: input.runId, joinToken: "" };
  }

  async renew(input: { threadId: string; runId: string; ttlSeconds: number }) {
    const [row] = await this.database
      .update(localConversations)
      .set({
        leaseUntil: new Date(Date.now() + input.ttlSeconds * 1000),
      })
      .where(
        and(
          eq(localConversations.id, input.threadId),
          eq(localConversations.runId, input.runId),
          gt(localConversations.leaseUntil, new Date()),
        ),
      )
      .returning();
    if (!row) throw new ConversationError("Conversation lease was lost.", 409);
    return { ttlSeconds: input.ttlSeconds };
  }

  async release(input: { threadId: string; runId: string }) {
    await this.database
      .update(localConversations)
      .set({ runId: null, leaseUntil: null })
      .where(
        and(
          eq(localConversations.id, input.threadId),
          eq(localConversations.runId, input.runId),
        ),
      );
  }

  /** Structural compatibility for existing headless tools; never constructs an Intelligence SDK. */
  readonly client = {
    getThread: async (input: { threadId: string; userId: string }) =>
      summary(await this.get(input.userId, input.threadId)),
    getOrCreateThread: (input: CreateThreadRequest) => this.ensure(input),
    getThreadMessages: (async (input: { threadId: string; userId: string }) => {
      let messages: Message[];
      try {
        messages = (await this.get(input.userId, input.threadId)).messages;
      } catch (error) {
        if (!(error instanceof ConversationError) || error.status !== 404)
          throw error;
        messages = [];
      }
      return {
        messages: messages.map((message) => {
          if (message.role !== "assistant") return message;
          return {
            ...message,
            toolCalls: message.toolCalls?.map((call) => ({
              id: call.id,
              name: call.function.name,
              args: call.function.arguments,
            })),
          };
        }),
      };
    }) as Method<"getThreadMessages">,
    ɵacquireThreadLock: (
      input: Parameters<CopilotKitIntelligence["ɵacquireThreadLock"]>[0],
    ) => this.acquire(input),
    ɵrenewThreadLock: (
      input: Parameters<CopilotKitIntelligence["ɵrenewThreadLock"]>[0],
    ) => this.renew(input),
    ɵcleanupThreadLock: (input: { threadId: string; runId: string }) =>
      this.release(input),
  };

  runner(
    owner?: string,
    onBusy?: (input: {
      threadId: string;
      runId: string;
      busy: boolean;
    }) => void | Promise<void>,
  ): AgentRunner {
    const store = this;
    return new (class extends AgentRunner {
      run(request: AgentRunnerRunRequest) {
        // Reserve synchronously, before an async admission can race with another run.
        if (store.active.has(request.threadId))
          throw new ConversationError("Conversation is already running.", 409);
        const active: Active = {
          owner: owner ?? "",
          request,
          events: new ReplaySubject(),
          stopped: false,
          done: Promise.resolve(),
        };
        store.active.set(request.threadId, active);
        active.done = store.execute(active, onBusy);
        return active.events.asObservable();
      }
      connect(request: AgentRunnerConnectRequest) {
        return new Observable<BaseEvent>((subscriber) => {
          let subscription: { unsubscribe(): void } | undefined;
          void (async () => {
            if (!owner)
              throw new ConversationError("A verified owner is required.", 401);
            let row: Row | undefined;
            try {
              row = await store.get(owner, request.threadId);
            } catch (error) {
              if (!(error instanceof ConversationError) || error.status !== 404)
                throw error;
            }
            if (subscriber.closed) return;
            const active = store.active.get(request.threadId);
            if (active && active.owner === owner) {
              subscriber.next({
                type: EventType.RUN_STARTED,
                threadId: request.threadId,
                runId: active.request.input.runId,
              });
              subscriber.next({
                type: EventType.MESSAGES_SNAPSHOT,
                messages:
                  active.initialMessages ?? active.request.input.messages,
              });
              subscriber.next({
                type: EventType.STATE_SNAPSHOT,
                snapshot: active.initialState ?? active.request.input.state,
              });
              subscription = active.events
                .pipe(filter((event) => event.type !== EventType.RUN_STARTED))
                .subscribe(subscriber);
            } else {
              const runId = randomUUID();
              subscriber.next({
                type: EventType.RUN_STARTED,
                threadId: request.threadId,
                runId,
              });
              subscriber.next({
                type: EventType.MESSAGES_SNAPSHOT,
                messages: row?.messages ?? [],
              });
              subscriber.next({
                type: EventType.STATE_SNAPSHOT,
                snapshot: row?.state ?? {},
              });
              subscriber.next({
                type: EventType.RUN_FINISHED,
                threadId: request.threadId,
                runId,
              });
              subscriber.complete();
            }
          })().catch((error) => subscriber.error(error));
          return () => subscription?.unsubscribe();
        });
      }
      async isRunning(request: AgentRunnerIsRunningRequest) {
        if (owner) {
          try {
            await store.get(owner, request.threadId);
          } catch {
            return false;
          }
        }
        return store.active.has(request.threadId);
      }
      async stop(request: AgentRunnerStopRequest) {
        const active = store.active.get(request.threadId);
        if (
          !active ||
          (owner && owner !== active.owner) ||
          (request.runId && request.runId !== active.request.input.runId)
        )
          return false;
        active.stopped = true;
        active.request.agent.abortRun();
        await active.request.agent.detachActiveRun();
        return true;
      }
    })();
  }

  private async execute(
    active: Active,
    onBusy?: (input: {
      threadId: string;
      runId: string;
      busy: boolean;
    }) => void | Promise<void>,
  ) {
    const { request } = active;
    const events: BaseEvent[] = [];
    let admitted = false;
    let ephemeralIds = new Set<string>();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const input = request.input;
    // The AG-UI client validates this boundary even when admission or storage fails.
    active.events.next({
      type: EventType.RUN_STARTED,
      threadId: request.threadId,
      runId: input.runId,
    });
    const save = async (
      messages: Message[],
      state: Record<string, unknown>,
    ) => {
      const changed = await this.database
        .update(localConversations)
        .set({
          messages,
          state,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(localConversations.id, request.threadId),
            eq(localConversations.ownerUserId, active.owner),
            eq(localConversations.runId, input.runId),
            gt(localConversations.leaseUntil, new Date()),
          ),
        )
        .returning({ id: localConversations.id });
      if (!changed.length)
        throw new ConversationError("Conversation lease was lost.", 409);
    };
    const signalBusy = async (busy: boolean) => {
      try {
        await onBusy?.({
          threadId: request.threadId,
          runId: input.runId,
          busy,
        });
      } catch {}
    };
    try {
      if (!active.owner) {
        // Only internal callers may use the unscoped runner. Their existing admission lock
        // binds both owner and run; never derive an owner from client-supplied forwarded props.
        const [row] = await this.database
          .select()
          .from(localConversations)
          .where(
            and(
              eq(localConversations.id, request.threadId),
              eq(localConversations.runId, input.runId),
            ),
          );
        if (!row)
          throw new ConversationError(
            "Background run has no conversation lease.",
            409,
          );
        active.owner = row.ownerUserId;
      }
      await this.ensure({
        threadId: request.threadId,
        userId: active.owner,
        agentId: request.agent.agentId ?? "default",
      });
      const row = await this.get(active.owner, request.threadId);
      if (row.runId !== input.runId)
        await this.acquire({
          threadId: request.threadId,
          userId: active.owner,
          agentId: row.agentId,
          runId: input.runId,
        });
      admitted = true;
      await signalBusy(true);
      heartbeat = setInterval(() => {
        void this.renew({
          threadId: request.threadId,
          runId: input.runId,
          ttlSeconds: 120,
        }).catch(() => {
          active.stopped = true;
          request.agent.abortRun();
          void request.agent.detachActiveRun();
        });
      }, 30_000);
      // Persist input before invoking the CLI. Do not let UI snapshots erase previous turns.
      const incoming = request.persistedInputMessages ?? input.messages;
      const incomingIds = new Set(incoming.map((message) => message.id));
      const messages = [
        ...row.messages.filter((message) => !incomingIds.has(message.id)),
        ...incoming,
      ];
      const modelInputIds = new Set(
        input.messages.map((message) => message.id),
      );
      const modelMessages = [
        ...row.messages.filter((message) => !modelInputIds.has(message.id)),
        ...input.messages,
      ];
      ephemeralIds = new Set(
        input.messages
          .filter(
            (message) =>
              !incomingIds.has(message.id) &&
              !row.messages.some((saved) => saved.id === message.id),
          )
          .map((message) => message.id),
      );
      input.messages = modelMessages;
      input.state = { ...row.state, ...input.state };
      request.agent.threadId = request.threadId;
      request.agent.setMessages(modelMessages);
      request.agent.setState(input.state);
      await save(messages, input.state);
      active.initialMessages = messages;
      active.initialState = input.state;
      if (!active.stopped) {
        await request.agent.runAgent(input, {
          onEvent: ({ event }) => {
            events.push(event);
            if (
              event.type !== EventType.RUN_STARTED &&
              event.type !== EventType.RUN_FINISHED &&
              event.type !== EventType.RUN_ERROR
            )
              active.events.next(event);
          },
        });
      }
      // An abort often completes the producer without a terminal event.
      for (const event of finalizeRunEvents(events, {
        stopRequested: active.stopped,
      })) {
        events.push(event);
        if (
          event.type !== EventType.RUN_FINISHED &&
          event.type !== EventType.RUN_ERROR
        )
          active.events.next(event);
      }
      await save(
        request.agent.messages.filter(
          (message) => !ephemeralIds.has(message.id),
        ),
        request.agent.state,
      );
    } catch (error) {
      const finalizers = finalizeRunEvents(events, {
        stopRequested: active.stopped,
        interruptionMessage:
          error instanceof Error ? error.message : "Conversation failed.",
      });
      for (const event of finalizers) {
        events.push(event);
        if (
          event.type !== EventType.RUN_FINISHED &&
          event.type !== EventType.RUN_ERROR
        )
          active.events.next(event);
      }
      if (admitted) {
        // Preserve partial responses and tool receipts after interruption; never rerun writes.
        await save(
          (request.agent.messages.length
            ? request.agent.messages
            : input.messages
          ).filter((message) => !ephemeralIds.has(message.id)),
          request.agent.state,
        ).catch(() => {});
      }
      if (!active.stopped)
        events.push({
          type: EventType.RUN_ERROR,
          message:
            error instanceof Error ? error.message : "Conversation failed.",
        });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (admitted) {
        await this.release({
          threadId: request.threadId,
          runId: input.runId,
        }).catch(() => {});
        await signalBusy(false);
      }
      // Completion follows the durable commit, so reload never outruns saved history.
      const terminal = events.findLast(
        (event) =>
          event.type === EventType.RUN_FINISHED ||
          event.type === EventType.RUN_ERROR,
      );
      if (this.active.get(request.threadId) === active)
        this.active.delete(request.threadId);
      active.events.next(
        terminal ?? {
          type: EventType.RUN_FINISHED,
          threadId: request.threadId,
          runId: input.runId,
        },
      );
      active.events.complete();
    }
  }

  async stop() {
    const active = [...this.active.values()];
    for (const run of active) {
      run.stopped = true;
      run.request.agent.abortRun();
      void run.request.agent.detachActiveRun();
    }
    await Promise.all(active.map((run) => run.done));
  }
}

let configured: LocalConversations | undefined;
export function configureLocalConversations(store: LocalConversations) {
  configured = store;
}
export function localConversationsStore() {
  if (!configured)
    throw new Error("Local conversation storage has not been initialized.");
  return configured;
}
