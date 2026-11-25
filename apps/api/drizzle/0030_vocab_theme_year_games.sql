ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "theme_preset" text DEFAULT 'classic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD COLUMN IF NOT EXISTS "example" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notebook_entries" ADD COLUMN IF NOT EXISTS "example" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notebook_entries" ADD COLUMN IF NOT EXISTS "topic" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notebook_entries" ADD COLUMN IF NOT EXISTS "unit" integer;
--> statement-breakpoint
ALTER TABLE "notebook_entries" ADD COLUMN IF NOT EXISTS "color" text DEFAULT 'default' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vocab_game_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"game_kind" text NOT NULL,
	"deck_label" text NOT NULL,
	"score" integer NOT NULL,
	"total_items" integer NOT NULL,
	"xp_awarded" integer NOT NULL,
	"played_day" text NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_game_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vocab_game_logs_user_day_idx" ON "vocab_game_logs" USING btree ("user_id","played_day");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vocab_game_logs_user_at_idx" ON "vocab_game_logs" USING btree ("user_id","played_at");
