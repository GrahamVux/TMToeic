/**
 * Load an upload manifest into the `assets` table (idempotent upsert on provider+bucket+object_key).
 *
 *   npm run assets:sync -w @toeic/api -- content/ets-2018.manifest.json
 *
 * Uses DATABASE_URL (Supabase) when set, otherwise the embedded PGlite in PGLITE_DIR. Stop the API first when using PGlite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { createDb } from '../db/database.module'
import { assets } from '../db/schema'
import { loadConfig, loadDotEnv } from '../config/app-config'
import type { ManifestItem } from './upload-zip'

type Manifest = { collection: string; bucket: string | null; items: ManifestItem[] }

async function main() {
  loadDotEnv()
  const file = process.argv[2]
  if (!file) throw new Error('Usage: sync-assets <manifest.json>')
  const manifest = JSON.parse(readFileSync(resolve(file), 'utf8')) as Manifest
  const config = loadConfig()
  const bucket = manifest.bucket ?? config.r2?.bucket
  if (!bucket) throw new Error('Manifest has no bucket and R2_BUCKET is not set.')
  const missingHash = manifest.items.filter((i) => !i.sha256)
  if (missingHash.length) throw new Error(`${missingHash.length} manifest items were never uploaded (dry run?). Run assets:upload first.`)

  const handle = await createDb({ ...config, autoMigrate: true })
  try {
    for (const i of manifest.items) {
      const original = i.sources[0].split('/').pop() ?? i.objectKey
      await handle.db
        .insert(assets)
        .values({
          provider: 'CLOUDFLARE_R2',
          bucket,
          objectKey: i.objectKey,
          mimeType: i.mimeType,
          sizeBytes: i.sizeBytes,
          checksum: i.sha256,
          originalFilename: original,
          metadata: { collection: i.collection, role: i.role, testNo: i.testNo, sources: i.sources },
        })
        .onConflictDoUpdate({
          target: [assets.provider, assets.bucket, assets.objectKey],
          set: {
            mimeType: sql`excluded.mime_type`,
            sizeBytes: sql`excluded.size_bytes`,
            checksum: sql`excluded.checksum`,
            originalFilename: sql`excluded.original_filename`,
            metadata: sql`excluded.metadata`,
          },
        })
    }
    console.log(`Synced ${manifest.items.length} assets (${handle.kind}).`)
  } finally {
    await handle.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
