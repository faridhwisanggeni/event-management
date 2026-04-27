-- Switch attendee roles from a static enum to a dynamic `attendee_roles` table.
-- This enables GET /roles and adding new roles without a schema migration.

-- 1. Dynamic roles table
CREATE TABLE "attendee_roles" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "code"       VARCHAR(40)    NOT NULL,
  "label"      VARCHAR(100)   NOT NULL,
  "sort_order" INTEGER        NOT NULL DEFAULT 0,
  "is_active"  BOOLEAN        NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "attendee_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendee_roles_code_key" ON "attendee_roles"("code");
CREATE INDEX "attendee_roles_sort_order_idx" ON "attendee_roles"("sort_order");

-- 2. Seed the 13 roles that existed as enum values. `ON CONFLICT` keeps it
--    idempotent in case the migration is re-run on a DB that was manually seeded.
INSERT INTO "attendee_roles" ("code", "label", "sort_order", "updated_at") VALUES
  ('BACKEND_DEVELOPER',        'Backend Developer',         10,  now()),
  ('FRONTEND_DEVELOPER',       'Frontend Developer',        20,  now()),
  ('FULLSTACK_DEVELOPER',      'Fullstack Developer',       30,  now()),
  ('AI_ENGINEER',              'AI Engineer',               40,  now()),
  ('DATABASE_ADMINISTRATOR',   'Database Administrator',    50,  now()),
  ('DEVOPS',                   'DevOps',                    60,  now()),
  ('DEVSECOPS',                'DevSecOps',                 70,  now()),
  ('NETWORK_ENGINEERING',      'Network Engineering',       80,  now()),
  ('ENGINEERING_MANAGER',      'Engineering Manager',       90,  now()),
  ('HEAD_OF_ENGINEERING',      'Head of Engineering',       100, now()),
  ('CHIEF_TECHNOLOGY_OFFICER', 'Chief Technology Officer',  110, now()),
  ('PRODUCT_OWNER',            'Product Owner',             120, now()),
  ('PROJECT_MANAGER',          'Project Manager',           130, now())
ON CONFLICT ("code") DO NOTHING;

-- 3. Add role_id column, migrate existing data, drop old enum column/type.
ALTER TABLE "attendees" ADD COLUMN "role_id" UUID;

UPDATE "attendees" a
SET "role_id" = r."id"
FROM "attendee_roles" r
WHERE a."role"::text = r."code";

DROP INDEX IF EXISTS "attendees_event_id_role_idx";
ALTER TABLE "attendees" DROP COLUMN "role";
DROP TYPE "attendee_role";

-- 4. Wire FK + new composite index.
ALTER TABLE "attendees"
  ADD CONSTRAINT "attendees_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "attendee_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "attendees_event_id_role_id_idx" ON "attendees"("event_id", "role_id");
