CREATE TABLE "daily_goals" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"reading_target" integer DEFAULT 0 NOT NULL,
	"listening_target" integer DEFAULT 0 NOT NULL,
	"vocab_target" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "daily_goals" ADD CONSTRAINT "daily_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
