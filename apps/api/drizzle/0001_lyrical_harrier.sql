CREATE TYPE "public"."asset_provider" AS ENUM('CLOUDFLARE_R2', 'GOOGLE_DRIVE');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."exam_mode" AS ENUM('PRACTICE', 'TIMED', 'FULL_TEST', 'PART_DRILL', 'RANDOM');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "asset_provider" NOT NULL,
	"bucket" text,
	"object_key" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint,
	"checksum" text,
	"original_filename" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"is_correct" boolean,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_spent_seconds" integer
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"mode" "exam_mode" NOT NULL,
	"status" "attempt_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"part_codes" jsonb NOT NULL,
	"scope_key" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"duration_seconds" integer,
	"total_questions" integer NOT NULL,
	"total_score" integer,
	"listening_score" integer,
	"reading_score" integer,
	"correct_count" integer,
	"incorrect_count" integer,
	"unanswered_count" integer
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"display_order" integer NOT NULL,
	"question_start" integer NOT NULL,
	"question_end" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_parts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "exam_status" DEFAULT 'DRAFT' NOT NULL,
	"difficulty" text DEFAULT 'MEDIUM' NOT NULL,
	"duration_seconds" integer NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"scoring_config" jsonb,
	"created_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"label" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"image_asset_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_part_id" uuid NOT NULL,
	"group_key" text NOT NULL,
	"instructions" text,
	"audio_asset_id" uuid,
	"image_asset_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_key" text NOT NULL,
	"option_text" text DEFAULT '' NOT NULL,
	"image_asset_id" uuid,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_part_id" uuid NOT NULL,
	"group_id" uuid,
	"question_number" integer NOT NULL,
	"type" text,
	"prompt" text DEFAULT '' NOT NULL,
	"image_asset_id" uuid,
	"audio_asset_id" uuid,
	"video_asset_id" uuid,
	"explanation_status" text DEFAULT 'NONE' NOT NULL,
	"difficulty" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_parts" ADD CONSTRAINT "exam_parts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_parts" ADD CONSTRAINT "exam_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_group_id_question_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."question_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_image_asset_id_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_exam_part_id_exam_parts_id_fk" FOREIGN KEY ("exam_part_id") REFERENCES "public"."exam_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_audio_asset_id_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_image_asset_id_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_image_asset_id_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_part_id_exam_parts_id_fk" FOREIGN KEY ("exam_part_id") REFERENCES "public"."exam_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_question_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."question_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_image_asset_id_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_audio_asset_id_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_video_asset_id_assets_id_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_answers_uq" ON "attempt_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "attempts_user_idx" ON "attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "attempts_exam_idx" ON "attempts" USING btree ("exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_active_uq" ON "attempts" USING btree ("user_id","exam_id","mode","scope_key") WHERE "attempts"."status" = 'IN_PROGRESS';--> statement-breakpoint
CREATE UNIQUE INDEX "exam_parts_uq" ON "exam_parts" USING btree ("exam_id","part_id");--> statement-breakpoint
CREATE INDEX "exam_parts_exam_idx" ON "exam_parts" USING btree ("exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exams_code_uq" ON "exams" USING btree ("code");--> statement-breakpoint
CREATE INDEX "exams_status_idx" ON "exams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "passages_group_idx" ON "passages" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_groups_uq" ON "question_groups" USING btree ("exam_part_id","group_key");--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_uq" ON "question_options" USING btree ("question_id","option_key");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_number_uq" ON "questions" USING btree ("exam_part_id","question_number");--> statement-breakpoint
CREATE INDEX "questions_group_idx" ON "questions" USING btree ("group_id");