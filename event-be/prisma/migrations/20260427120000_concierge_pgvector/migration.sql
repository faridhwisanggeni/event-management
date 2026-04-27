-- Enable pgvector extension (image: pgvector/pgvector:pg16)
CREATE EXTENSION IF NOT EXISTS "vector";

-- ConciergeRole enum
CREATE TYPE "concierge_role" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');

-- Attendee.embedding column (vector(1536))
ALTER TABLE "attendees" ADD COLUMN "embedding" vector(1536);

-- IVFFLAT index for cosine similarity. Lists=100 is a sensible default for
-- small/medium datasets; rebuild with higher lists once row count grows.
CREATE INDEX "attendees_embedding_cosine_idx"
  ON "attendees" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- ConciergeSession
CREATE TABLE "concierge_sessions" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "event_id"     UUID         NOT NULL,
  "attendee_id"  UUID         NOT NULL,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "concierge_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "concierge_sessions_event_id_attendee_id_key"
  ON "concierge_sessions" ("event_id", "attendee_id");

ALTER TABLE "concierge_sessions"
  ADD CONSTRAINT "concierge_sessions_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "concierge_sessions"
  ADD CONSTRAINT "concierge_sessions_attendee_id_fkey"
  FOREIGN KEY ("attendee_id") REFERENCES "attendees" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ConciergeMessage
CREATE TABLE "concierge_messages" (
  "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
  "session_id"        UUID            NOT NULL,
  "role"              "concierge_role" NOT NULL,
  "content"           TEXT,
  "tool_calls"        JSONB,
  "tool_call_id"      VARCHAR(64),
  "tool_name"         VARCHAR(64),
  "matches"           JSONB,
  "prompt_tokens"     INTEGER,
  "completion_tokens" INTEGER,
  "latency_ms"        INTEGER,
  "created_at"        TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "concierge_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "concierge_messages_session_id_created_at_idx"
  ON "concierge_messages" ("session_id", "created_at");

ALTER TABLE "concierge_messages"
  ADD CONSTRAINT "concierge_messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "concierge_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Feedback
CREATE TABLE "concierge_feedback" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID           NOT NULL,
  "rating"     INTEGER        NOT NULL,
  "notes"      TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "concierge_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "concierge_feedback_message_id_key"
  ON "concierge_feedback" ("message_id");

ALTER TABLE "concierge_feedback"
  ADD CONSTRAINT "concierge_feedback_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "concierge_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
