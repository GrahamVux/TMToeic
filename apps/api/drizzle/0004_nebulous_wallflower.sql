CREATE TYPE "public"."assignment_lifecycle" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "assignment_students" (
	"assignment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignment_students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by" uuid,
	"exam_id" uuid NOT NULL,
	"part_codes" jsonb NOT NULL,
	"duration_seconds" integer NOT NULL,
	"due_at" timestamp with time zone,
	"status" "assignment_lifecycle" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "attempts_one_active_uq";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "assignment_id" uuid;--> statement-breakpoint
ALTER TABLE "assignment_students" ADD CONSTRAINT "assignment_students_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_students" ADD CONSTRAINT "assignment_students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_students_uq" ON "assignment_students" USING btree ("assignment_id","user_id");--> statement-breakpoint
CREATE INDEX "assignment_students_user_idx" ON "assignment_students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assignments_exam_idx" ON "assignments" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "assignments_status_idx" ON "assignments" USING btree ("status","due_at");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_assignment_idx" ON "attempts" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_assignment_active_uq" ON "attempts" USING btree ("user_id","assignment_id") WHERE "attempts"."status" = 'IN_PROGRESS' AND "attempts"."assignment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_active_uq" ON "attempts" USING btree ("user_id","exam_id","mode","scope_key") WHERE "attempts"."status" = 'IN_PROGRESS' AND "attempts"."assignment_id" is null;