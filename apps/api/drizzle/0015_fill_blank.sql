ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "accepted_answers" jsonb;
--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN IF NOT EXISTS "answer_text" text;
--> statement-breakpoint
INSERT INTO "parts" ("id", "skill_id", "code", "name", "description", "display_order")
SELECT gen_random_uuid(), s.id, 'FILL_1', 'Điền từ', 'Điền từ vào chỗ khuyết', 8
FROM "skills" s
WHERE s.code = 'READING'
  AND NOT EXISTS (SELECT 1 FROM "parts" p WHERE p.code = 'FILL_1');
