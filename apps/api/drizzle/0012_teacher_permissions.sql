ALTER TABLE "users" ADD COLUMN "perm_create_students" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "perm_manage_assignments" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "perm_view_progress" boolean DEFAULT true NOT NULL;
