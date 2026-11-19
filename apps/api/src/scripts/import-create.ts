/**
 * Turn a reviewed draft (from `import:lc`) into a real exam. Idempotent on the exam code.
 *
 *   npm run import:create -w @toeic/api -- ets-2018 7          (stop the API first when using the embedded PGlite)
 *
 *  1. uploads the cropped photos / figures to R2 and registers them in `assets`
 *  2. creates the exam (parts from the draft) if its code does not exist yet
 *  3. replaces its content (groups, questions, answer key, images)
 *  4. attaches the full-length recording already uploaded by `assets:upload`
 *  5. leaves the exam in PENDING_REVIEW so a teacher checks it before publishing
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import type { ImportListeningDraftInput } from '@toeic/shared'
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@toeic/shared'
import { AuditService } from '../audit/audit.service'
import { loadConfig, loadDotEnv } from '../config/app-config'
import { createDb } from '../db/database.module'
import { users } from '../db/schema'
import { ExamsService } from '../exams/exams.service'
import type { Draft } from '../importer/draft'
import { AssetStoreService } from '../storage/asset-store.service'
import { StorageService } from '../storage/storage.service'

const IMAGE_MIME = 'image/jpeg'
const API_BASE = process.env.TOEIC_API_URL ?? 'http://127.0.0.1:3001/api/v1'

async function apiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

function buildPayload(opts: {
  collection: string
  testNo: number
  testDir: string
  dir: string
  draft: Draft
  imageFiles: string[]
  audio?: { objectKey: string; mimeType: string; sizeBytes: number; checksum: string; originalFilename: string }
}): ImportListeningDraftInput {
  const { collection, testNo, testDir, dir, draft, imageFiles, audio } = opts
  const assets: ImportListeningDraftInput['assets'] = imageFiles.map((file) => {
    const data = readFileSync(join(dir, file))
    return {
      objectKey: `${collection}/${testDir}/images/${file}`,
      mimeType: IMAGE_MIME,
      sizeBytes: data.length,
      checksum: createHash('sha256').update(data).digest('hex'),
      originalFilename: file,
      metadata: { collection, role: 'QUESTION_IMAGE', testNo },
    }
  })
  if (audio) {
    assets.push({
      objectKey: audio.objectKey,
      mimeType: audio.mimeType,
      sizeBytes: audio.sizeBytes,
      checksum: audio.checksum,
      originalFilename: audio.originalFilename,
      metadata: { collection, role: 'FULL_AUDIO', testNo },
    })
  }
  return {
    exam: {
      code: draft.exam.code,
      title: draft.exam.title,
      source: collection,
      difficulty: 'MEDIUM',
      durationSeconds: draft.exam.durationSeconds,
      parts: [...draft.exam.parts],
    },
    assets,
    groups: draft.groups.map((g) => ({
      key: g.key,
      partCode: g.partCode,
      instructions: g.instructions,
      imageObjectKey: g.imageFile ? `${collection}/${testDir}/images/${g.imageFile}` : undefined,
      passages: g.passages ?? [],
    })),
    questions: draft.questions.map((q) => ({
      number: q.number,
      partCode: q.partCode,
      type: 'MULTIPLE_CHOICE',
      prompt: q.prompt,
      groupKey: q.groupKey,
      imageObjectKey: q.imageFile ? `${collection}/${testDir}/images/${q.imageFile}` : undefined,
      options: q.options.map((o) => ({ key: o.key, text: o.text, correct: q.answer === o.key })),
    })),
    audioObjectKey: audio?.objectKey,
  }
}

async function main() {
  loadDotEnv()
  const [collection, testArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const testNo = Number(testArg)
  const isRc = process.argv.includes('--rc')
  if (!collection || !Number.isInteger(testNo)) throw new Error('Usage: import-create <collection> <testNo> [--rc]')
  const testDir = `test-${String(testNo).padStart(2, '0')}${isRc ? '-rc' : ''}`
  const dir = resolve('content', 'drafts', collection, testDir)
  const draft = JSON.parse(readFileSync(join(dir, 'draft.json'), 'utf8')) as Draft
  if (draft.warnings.length && !process.argv.includes('--force')) {
    throw new Error(`The draft has ${draft.warnings.length} warning(s); fix them or pass --force.`)
  }

  const config = loadConfig()
  if (!config.r2) throw new Error('R2 is not configured (R2_* in apps/api/.env)')

  const files = [...new Set([...draft.groups.map((g) => g.imageFile), ...draft.questions.map((q) => q.imageFile)].filter((f): f is string => !!f))]
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
  })
  for (const file of files) {
    const data = readFileSync(join(dir, file))
    await s3.send(
      new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: `${collection}/${testDir}/images/${file}`,
        Body: data,
        ContentType: IMAGE_MIME,
      }),
    )
  }
  console.log(`Uploaded ${files.length} image(s) to R2`)

  const manifestPath = resolve('content', `${collection}.manifest.json`)
  let audio: { objectKey: string; mimeType: string; sizeBytes: number; checksum: string; originalFilename: string } | undefined
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      items: Array<{ objectKey: string; mimeType: string; sizeBytes: number; sha256?: string; role?: string; testNo?: number; sources?: string[] }>
    }
    const item = isRc ? undefined : manifest.items.find((i) => i.role === 'FULL_AUDIO' && i.testNo === testNo)
    if (item?.sha256) {
      audio = {
        objectKey: item.objectKey,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        checksum: item.sha256,
        originalFilename: item.sources?.[0]?.split('/').pop() ?? 'full.mp3',
      }
    }
  }

  const payload = buildPayload({ collection, testNo, testDir, dir, draft, imageFiles: files, audio })
  writeFileSync(join(dir, 'import-payload.json'), JSON.stringify(payload))

  if (await apiHealth()) {
    const res = await fetch(`${API_BASE}/exams/import-draft`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CSRF_HEADER]: CSRF_HEADER_VALUE,
        ...(process.env.TOEIC_COOKIE ? { cookie: process.env.TOEIC_COOKIE } : {}),
      },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => null)
    if (res.ok) {
      console.log(`Imported via running API: ${(body as { code?: string }).code} (${(body as { status?: string }).status})`)
      return
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `API is running — cannot open a second PGlite copy. Payload saved at ${join(dir, 'import-payload.json')}. Log in as admin and POST it to ${API_BASE}/exams/import-draft, or set TOEIC_COOKIE.`,
      )
    }
    throw new Error(`API import failed (${res.status}): ${JSON.stringify(body)}`)
  }

  // API is down: safe to open the embedded database.
  const handle = await createDb({ ...config, autoMigrate: true })
  try {
    const db = handle.db
    const audit = new AuditService(db)
    const examsService = new ExamsService(db, config, audit, new AssetStoreService(db, new StorageService(config)))
    const [admin] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.role, 'ADMIN')).limit(1)
    if (!admin) throw new Error('No ADMIN user exists to own the imported exam')
    const summary = await examsService.importListeningDraft({ id: admin.id, role: admin.role }, payload)
    console.log(`Imported locally: ${summary.code} (${summary.status})`)
    const problems = await examsService.validateForPublish(summary.id)
    console.log(problems.length ? `Publish check: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}` : 'Publish check: OK (ready for a teacher to review and publish)')
  } finally {
    await handle.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
