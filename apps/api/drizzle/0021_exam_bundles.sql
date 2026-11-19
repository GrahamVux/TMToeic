CREATE TABLE "exam_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"listening_exam_id" uuid NOT NULL,
	"reading_exam_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_bundles_exam_id_unique" UNIQUE("exam_id"),
	CONSTRAINT "exam_bundles_pair_uq" UNIQUE("listening_exam_id","reading_exam_id")
);
--> statement-breakpoint
ALTER TABLE "exam_bundles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "exam_bundles" ADD CONSTRAINT "exam_bundles_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_bundles" ADD CONSTRAINT "exam_bundles_listening_exam_id_exams_id_fk" FOREIGN KEY ("listening_exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_bundles" ADD CONSTRAINT "exam_bundles_reading_exam_id_exams_id_fk" FOREIGN KEY ("reading_exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_bundles" ADD CONSTRAINT "exam_bundles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
