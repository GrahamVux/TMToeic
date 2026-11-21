CREATE TABLE "vocab_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"topic_key" text NOT NULL,
	"title" text NOT NULL,
	"title_key" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_sets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vocab_sets" ADD CONSTRAINT "vocab_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "vocab_sets_topic_title_uq" ON "vocab_sets" USING btree ("topic_key","title_key");
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD COLUMN "set_id" uuid;
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD CONSTRAINT "vocab_entries_set_id_vocab_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."vocab_sets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "vocab_entries_set_idx" ON "vocab_entries" USING btree ("set_id");
