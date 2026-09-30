/**
 * Stream a zip of course material straight to Cloudflare R2 (no extraction to disk) and write a manifest.
 *
 *   npm run assets:upload -w @toeic/api -- "C:\path\ETS 2018.zip" [--collection ets-2018] [--dry]
 *
 * - Object keys are ASCII and deterministic (see assets/ets-layout.ts).
 * - Byte-identical files (same size + CRC32) are uploaded once; every source path is kept in the manifest.
 * - Re-runnable: objects that already exist with the same size are not uploaded again.
 * - Output: content/<collection>.manifest.json — load it into the database with `npm run assets:sync`.
 */
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import type yauzl from 'yauzl'
import { loadConfig, loadDotEnv } from '../config/app-config'
import { openEntry, openZip, readAllEntries } from './zip-util'
import { classifyEtsPath, type AssetRole } from '../assets/ets-layout'

export type ManifestItem = {
  objectKey: string
  mimeType: string
  sizeBytes: number
  sha256: string | null
  role: AssetRole
  testNo: number | null
  collection: string
  sources: string[]
  uploaded: 'uploaded' | 'already-present' | 'dry-run'
}

type Planned = Omit<ManifestItem, 'sha256' | 'uploaded'> & { crc32: number; entry: yauzl.Entry }

function plan(entries: yauzl.Entry[], collection: string): Planned[] {
  const byContent = new Map<string, Planned>()
  const byKey = new Map<string, Planned>()
  const out: Planned[] = []
  for (const entry of entries) {
    const c = classifyEtsPath(entry.fileName, collection)
    if (!c) continue
    const contentKey = `${entry.uncompressedSize}:${entry.crc32}`
    const same = byContent.get(contentKey)
    if (same) {
      same.sources.push(entry.fileName)
      continue
    }
    let objectKey = c.objectKey
    if (byKey.has(objectKey)) {
      // Different bytes under the same name → disambiguate with the CRC.
      const dot = objectKey.lastIndexOf('.')
      objectKey = `${objectKey.slice(0, dot)}-${entry.crc32.toString(16).padStart(8, '0')}${objectKey.slice(dot)}`
    }
    const p: Planned = {
      objectKey,
      mimeType: c.mimeType,
      sizeBytes: entry.uncompressedSize,
      role: c.role,
      testNo: c.testNo,
      collection: c.collection,
      sources: [entry.fileName],
      crc32: entry.crc32,
      entry,
    }
    byContent.set(contentKey, p)
    byKey.set(objectKey, p)
    out.push(p)
  }
  return out
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

async function main() {
  loadDotEnv()
  const args = process.argv.slice(2)
  const zipPath = args.find((a) => !a.startsWith('--'))
  if (!zipPath) throw new Error('Usage: upload-zip <file.zip> [--collection ets-2018] [--dry]')
  const dry = args.includes('--dry')
  const ci = args.indexOf('--collection')
  const collection = ci >= 0 ? args[ci + 1] : 'ets-2018'

  const config = loadConfig()
  if (!dry && !config.r2) throw new Error('R2_* variables are not set (apps/api/.env).')

  const zip = await openZip(resolve(zipPath))
  const planned = plan(await readAllEntries(zip), collection)
  const totalBytes = planned.reduce((s, p) => s + p.sizeBytes, 0)
  console.log(`${planned.length} unique files, ${mb(totalBytes)} to ${dry ? 'plan (dry run)' : 'sync'} → collection "${collection}"`)

  const s3 = config.r2
    ? new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
      })
    : null

  const items: ManifestItem[] = []
  let done = 0
  for (const p of planned) {
    const { entry, crc32: _crc, ...rest } = p
    void _crc
    let uploaded: ManifestItem['uploaded'] = 'dry-run'
    let sha256: string | null = null

    if (!dry && s3 && config.r2) {
      const present = await s3
        .send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: p.objectKey }))
        .then((h) => h.ContentLength === p.sizeBytes)
        .catch((e) => {
          if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false
          throw e
        })

      const hash = createHash('sha256')
      const source = await openEntry(zip, entry)
      const tap = new PassThrough()
      tap.on('data', (chunk: Buffer) => hash.update(chunk))
      source.pipe(tap)

      if (present) {
        await new Promise<void>((res, rej) => {
          tap.on('end', res)
          tap.on('error', rej)
          source.on('error', rej)
          tap.resume()
        })
        uploaded = 'already-present'
      } else {
        source.on('error', (e) => tap.destroy(e))
        const upload = new Upload({
          client: s3,
          queueSize: 4,
          partSize: 16 * 1024 * 1024,
          leavePartsOnError: false,
          params: { Bucket: config.r2.bucket, Key: p.objectKey, Body: tap, ContentType: p.mimeType },
        })
        await upload.done()
        uploaded = 'uploaded'
      }
      sha256 = hash.digest('hex')
    }

    items.push({ ...rest, sha256, uploaded })
    done++
    console.log(`[${done}/${planned.length}] ${uploaded.padEnd(15)} ${mb(p.sizeBytes).padStart(9)}  ${p.objectKey}`)
  }
  zip.close()

  const out = resolve('content', `${collection}.manifest.json`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    JSON.stringify({ collection, generatedAt: new Date().toISOString(), bucket: config.r2?.bucket ?? null, items }, null, 2),
  )
  const counts = items.reduce<Record<string, number>>((m, i) => ((m[i.uploaded] = (m[i.uploaded] ?? 0) + 1), m), {})
  console.log('Manifest written:', out, counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
