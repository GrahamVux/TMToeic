ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_frame" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_frame_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reward_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "honor_reward_config" jsonb;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_avatar_frames" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "frame_id" text NOT NULL,
  "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  PRIMARY KEY ("user_id", "frame_id")
);--> statement-breakpoint
ALTER TABLE "user_avatar_frames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "honor_settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cycle_key" text NOT NULL,
  "scope_key" text NOT NULL,
  "period" text NOT NULL,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "class_name" text,
  "winners" jsonb NOT NULL,
  "triggered_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "settled_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "honor_settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "honor_settlements_cycle_scope_uq" ON "honor_settlements" ("cycle_key", "scope_key");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_point_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "delta" integer NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL,
  "settlement_id" uuid REFERENCES "honor_settlements"("id") ON DELETE SET NULL,
  "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "reward_point_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_point_ledger_user_idx" ON "reward_point_ledger" ("user_id", "created_at");--> statement-breakpoint
INSERT INTO "honor_settlements" ("cycle_key", "scope_key", "period", "winners")
VALUES ('INIT_ROLLOUT', 'SYSTEM', 'week', '[]'::jsonb)
ON CONFLICT ("cycle_key", "scope_key") DO NOTHING;