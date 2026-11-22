CREATE TABLE "account_avatars" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "version" uuid NOT NULL UNIQUE,
  "thumbnail" bytea NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_avatars" ENABLE ROW LEVEL SECURITY;
