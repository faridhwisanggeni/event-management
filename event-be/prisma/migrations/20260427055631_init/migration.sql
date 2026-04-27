-- CreateEnum
CREATE TYPE "attendee_role" AS ENUM ('BACKEND_DEVELOPER', 'FRONTEND_DEVELOPER', 'FULLSTACK_DEVELOPER', 'PROJECT_MANAGER', 'PRODUCT_OWNER', 'CHIEF_TECHNOLOGY_OFFICER', 'HEAD_OF_ENGINEERING', 'ENGINEERING_MANAGER', 'DATABASE_ADMINISTRATOR', 'DEVOPS', 'DEVSECOPS', 'NETWORK_ENGINEERING');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "headline" VARCHAR(200),
    "bio" TEXT,
    "company" VARCHAR(120),
    "role" "attendee_role",
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "looking_for" TEXT,
    "open_to_chat" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");

-- CreateIndex
CREATE INDEX "attendees_event_id_idx" ON "attendees"("event_id");

-- CreateIndex
CREATE INDEX "attendees_event_id_role_idx" ON "attendees"("event_id", "role");

-- CreateIndex
CREATE INDEX "attendees_skills_idx" ON "attendees" USING GIN ("skills");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
