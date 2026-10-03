CREATE TABLE "grammar_lesson_files" (
	"lesson_id" uuid PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"pdf_bytes" bytea NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grammar_lesson_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "grammar_lesson_files" ADD CONSTRAINT "grammar_lesson_files_lesson_id_grammar_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."grammar_lessons"("id") ON DELETE cascade ON UPDATE no action;
