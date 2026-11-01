CREATE TABLE "reading_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" uuid NOT NULL,
	"passage_label" text DEFAULT '' NOT NULL,
	"option_key" text DEFAULT '' NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"quote" text NOT NULL,
	"color" text,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_marks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reading_marks" ADD CONSTRAINT "reading_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reading_marks" ADD CONSTRAINT "reading_marks_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "reading_marks_span_uq" ON "reading_marks" USING btree ("user_id","exam_id","target_kind","target_id","passage_label","option_key","start_offset","end_offset");
--> statement-breakpoint
CREATE INDEX "reading_marks_user_exam_idx" ON "reading_marks" USING btree ("user_id","exam_id");
