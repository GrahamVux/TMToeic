CREATE TABLE "class_teachers" (
  "class_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  CONSTRAINT "class_teachers_class_id_user_id_pk" PRIMARY KEY("class_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "class_teachers_user_idx" ON "class_teachers" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "class_teachers" ENABLE ROW LEVEL SECURITY;
