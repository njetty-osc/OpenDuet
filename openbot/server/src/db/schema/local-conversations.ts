import type { Message } from "@ag-ui/client";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { jsonb } from "./json";

/** The complete transcript stays local, independently of provider sessions. */
export const localConversations = pgTable(
  "local_conversations",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    agentId: text("agent_id").notNull(),
    name: text("name"),
    archived: boolean("archived").notNull().default(false),
    messages: jsonb("messages").$type<Message[]>().notNull().default([]),
    state: jsonb("state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    runId: text("run_id"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("local_conversations_owner_updated").on(
      table.ownerUserId,
      table.updatedAt,
    ),
  ],
);
