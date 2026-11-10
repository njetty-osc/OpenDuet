CREATE TABLE "local_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "name" text,
  "archived" boolean DEFAULT false NOT NULL,
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "run_id" text,
  "lease_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "local_conversations_owner_updated" ON "local_conversations" ("owner_user_id", "updated_at");
