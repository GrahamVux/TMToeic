ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "theme_preset" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "student_allowed_themes" jsonb DEFAULT '["classic","auto","spring","summer","autumn","winter","tet","liberation","national_day","mid_autumn","halloween","christmas"]'::jsonb NOT NULL;
