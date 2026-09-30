ALTER TABLE "exam_parts" ADD COLUMN "audio_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "audio_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "exam_parts" ADD CONSTRAINT "exam_parts_audio_asset_id_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_audio_asset_id_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;