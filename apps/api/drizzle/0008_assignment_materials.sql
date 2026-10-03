ALTER TABLE "assignments" ADD COLUMN "audio_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_audio_asset_id_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "assignment_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignment_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "assignment_images" ADD CONSTRAINT "assignment_images_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assignment_images" ADD CONSTRAINT "assignment_images_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "assignment_images_assignment_idx" ON "assignment_images" USING btree ("assignment_id","display_order");
