ALTER TABLE "users" ADD COLUMN "goal_track" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "target_score_min" integer;--> statement-breakpoint
UPDATE "users" SET "goal_track" = 'TWO_SKILL', "target_score_min" = "target_score" WHERE "target_score" IS NOT NULL;
