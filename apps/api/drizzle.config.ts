import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` only diffs the schema and writes SQL migrations — no DB connection needed.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
