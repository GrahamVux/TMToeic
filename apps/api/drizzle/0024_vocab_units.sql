CREATE TABLE "vocab_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_units" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vocab_units" ADD CONSTRAINT "vocab_units_set_id_vocab_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."vocab_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "vocab_units_set_position_uq" ON "vocab_units" USING btree ("set_id","position");
--> statement-breakpoint
CREATE INDEX "vocab_units_set_idx" ON "vocab_units" USING btree ("set_id");
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD COLUMN "unit_id" uuid;
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD CONSTRAINT "vocab_entries_unit_id_vocab_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."vocab_units"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "vocab_entries_unit_idx" ON "vocab_entries" USING btree ("unit_id");
--> statement-breakpoint
WITH numbered AS (
	SELECT id, set_id,
		(((row_number() OVER (PARTITION BY set_id ORDER BY word_key, id) - 1) / 30) + 1)::int AS position,
		row_number() OVER (PARTITION BY set_id ORDER BY word_key, id)::int AS display_order
	FROM vocab_entries
	WHERE set_id IS NOT NULL
),
created AS (
	INSERT INTO vocab_units (set_id, position)
	SELECT DISTINCT set_id, position FROM numbered
	RETURNING id, set_id, position
)
UPDATE vocab_entries AS entry
SET unit_id = created.id, display_order = numbered.display_order
FROM numbered
JOIN created ON created.set_id = numbered.set_id AND created.position = numbered.position
WHERE entry.id = numbered.id;
