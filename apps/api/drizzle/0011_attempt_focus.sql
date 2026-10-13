CREATE TABLE "attempt_focus_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"left_at" timestamp with time zone NOT NULL,
	"returned_at" timestamp with time zone,
	"away_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "attempt_focus_leaves" ADD CONSTRAINT "attempt_focus_leaves_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "attempt_focus_attempt_idx" ON "attempt_focus_leaves" USING btree ("attempt_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_focus_one_open_uq" ON "attempt_focus_leaves" USING btree ("attempt_id") WHERE "returned_at" is null;
--> statement-breakpoint
ALTER TABLE "attempt_focus_leaves" ENABLE ROW LEVEL SECURITY;
