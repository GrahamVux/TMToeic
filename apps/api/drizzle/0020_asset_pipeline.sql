ALTER TABLE "assets" ADD COLUMN "status" text DEFAULT 'STORED' NOT NULL;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "error" text;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "uploaded_by" uuid;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "stored_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "source_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;
