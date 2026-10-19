CREATE TABLE "classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "classes_name_uq" ON "classes" (lower("name"));
--> statement-breakpoint
CREATE TABLE "class_members" (
  "class_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  CONSTRAINT "class_members_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "class_members_class_idx" ON "class_members" USING btree ("class_id");
--> statement-breakpoint
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "class_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "honor_board_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
INSERT INTO "classes" ("id", "name") VALUES ('00000000-0000-4000-8000-000000000042', 'Lớp K42');
--> statement-breakpoint
INSERT INTO "class_members" ("class_id", "user_id")
SELECT '00000000-0000-4000-8000-000000000042', "id" FROM "users" WHERE "role" = 'STUDENT';
