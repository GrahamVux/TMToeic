/**
 * AI-assisted import of one Reading test (~100 questions, Parts 5–7).
 *
 *   npm run import:rc -w @toeic/api -- 7 --pages-dir content/drafts/ets-2018/_rc-pages --from 188 --to 218 --rotate 180
 *
 * Answer key: --key <pdf>  OR  pages/<answers.json> already cached  OR  --key-image <jpg>
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { loadDotEnv } from '../config/app-config'
import { extractPdfJpegs } from '../importer/pdf-images'
import { groupStripsIntoPages, stitchPage } from '../importer/pdf-pages'
import { GeminiError } from '../importer/gemini'
import { assembleReadingDraft, DEFAULT_MODELS, ModelRunner, readRcPage, readReadingAnswerKey, type RcPageRead } from '../importer/rc-extract'
import { entryBuffer, openZip, readAllEntries } from './zip-util'

const EMPTY: RcPageRead = { testNo: null, firstQuestion: null, lastQuestion: null, questions: [], groupHeadings: [], passages: [], graphics: [] }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function flagVal(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

async function loadPagesFromZip(zipPath: string): Promise<Array<{ page: number; buffer: Buffer }>> {
  const zip = await openZip(zipPath)
  const entries = await readAllEntries(zip)
  const rc = entries.find((e) => /new economy toeic rc 1000\.pdf/i.test(e.fileName))
  if (!rc) {
    zip.close()
    throw new Error('Không thấy New economy TOEIC RC 1000.pdf trong zip')
  }
  const pdf = await entryBuffer(zip, rc)
  zip.close()
  const groups = groupStripsIntoPages(extractPdfJpegs(pdf))
  const pages: Array<{ page: number; buffer: Buffer }> = []
  for (const g of groups) {
    const stitched = await stitchPage(g)
    if (stitched.height < 800) continue
    pages.push({ page: pages.length + 1, buffer: stitched.data })
  }
  return pages
}

async function loadPagesFromDir(dir: string): Promise<Array<{ page: number; buffer: Buffer }>> {
  const files = readdirSync(dir).filter((f) => /^page-\d+\.jpg$/.test(f)).sort()
  const pages: Array<{ page: number; buffer: Buffer }> = []
  for (const f of files) {
    const n = Number(f.slice(5, 8))
    const buf = readFileSync(join(dir, f))
    const meta = await sharp(buf).metadata()
    if ((meta.height ?? 0) < 800) continue
    pages.push({ page: n, buffer: buf })
  }
  return pages
}

async function main() {
  loadDotEnv()
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY is not set (apps/api/.env)')
  const models = process.env.AI_MODELS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_MODELS
  const rawArgs = process.argv.slice(2)
  const pagesDir = flagVal(rawArgs, '--pages-dir')
  const keyPath = flagVal(rawArgs, '--key')
  const keyImage = flagVal(rawArgs, '--key-image')
  const fromPage = Number(flagVal(rawArgs, '--from'))
  const toPage = Number(flagVal(rawArgs, '--to'))
  const rotate = Number(flagVal(rawArgs, '--rotate') ?? 0)
  const taken = new Set<string>(['--pages-dir', '--key', '--key-image', '--from', '--to', '--rotate', '--cache-only', '--slow'])
  const args = rawArgs.filter((a, i) => !taken.has(a) && !taken.has(rawArgs[i - 1] ?? ''))
  const testNo = Number(args.find((a) => /^\d+$/.test(a)))
  const zipPath = args.find((a) => !/^\d+$/.test(a))
  if (!Number.isInteger(testNo)) throw new Error('Usage: import-rc [zip] <testNo> --pages-dir <dir> --from N --to M [--rotate 180] [--key pdf|--key-image jpg]')

  const collection = 'ets-2018'
  const cacheOnly = rawArgs.includes('--cache-only')
  const pageDelayMs = Number(process.env.AI_PAGE_DELAY_MS ?? (rawArgs.includes('--slow') ? 25_000 : 8_000))
  const dir = resolve('content', 'drafts', collection, `test-${String(testNo).padStart(2, '0')}-rc`)
  const cacheDir = join(dir, 'pages')
  mkdirSync(cacheDir, { recursive: true })

  console.log(`Test ${testNo} Reading: loading pages…`)
  let allPages = pagesDir ? await loadPagesFromDir(resolve(pagesDir)) : zipPath ? await loadPagesFromZip(zipPath) : []
  if (!allPages.length) throw new Error('Không có trang nào (cần --pages-dir hoặc zip)')
  const sliced = Number.isInteger(fromPage) && Number.isInteger(toPage) ? allPages.filter((p) => p.page >= fromPage && p.page <= toPage) : allPages
  const pages = rotate
    ? await Promise.all(sliced.map(async (p) => ({ page: p.page, buffer: await sharp(p.buffer).rotate(rotate).jpeg({ quality: 85 }).toBuffer() })))
    : sliced
  console.log(`${pages.length} pages (book has ${allPages.length}); models: ${models.join(' → ')}${cacheOnly ? ' (cache only)' : ''}`)

  const runner = new ModelRunner(apiKey, models)
  let quotaHit = false
  const reads: Array<{ page: number; read: RcPageRead }> = []
  for (const p of pages) {
    const cacheFile = join(cacheDir, `p${String(p.page).padStart(3, '0')}.json`)
    let read: RcPageRead
    if (existsSync(cacheFile)) read = JSON.parse(readFileSync(cacheFile, 'utf8')) as RcPageRead
    else if (cacheOnly || quotaHit) read = EMPTY
    else {
      if (pageDelayMs > 0) await sleep(pageDelayMs)
      let lastErr: unknown
      read = EMPTY
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          read = await readRcPage(runner, p.buffer)
          writeFileSync(cacheFile, JSON.stringify(read))
          lastErr = undefined
          break
        } catch (err) {
          lastErr = err
          if (err instanceof GeminiError && err.status === 429 && /PerDay|free_tier_requests/i.test(err.message)) {
            quotaHit = true
            console.warn(`  daily quota at page ${p.page}`)
            break
          }
          if (err instanceof GeminiError && (err.status === 429 || err.status >= 500 || err.status === 200)) {
            const wait = 20_000 * (attempt + 1)
            console.warn(`  page ${p.page} ${err.status}, retry in ${wait / 1000}s`)
            await sleep(wait)
            continue
          }
          throw err
        }
      }
      if (lastErr && !quotaHit && !existsSync(cacheFile)) {
        console.warn(`  page ${p.page} skipped after retries: ${lastErr instanceof Error ? lastErr.message : lastErr}`)
      }
    }
    console.log(`  page ${p.page}: Q${read.firstQuestion ?? '-'}–${read.lastQuestion ?? '-'} ${read.questions.length}q ${read.passages.length} passages`)
    reads.push({ page: p.page, read })
  }

  console.log('Reading the answer key…')
  const keyFile = join(cacheDir, 'answers.json')
  let answers: Map<number, 'A' | 'B' | 'C' | 'D'>
  if (existsSync(keyFile)) {
    answers = new Map(JSON.parse(readFileSync(keyFile, 'utf8')) as Array<[number, 'A' | 'B' | 'C' | 'D']>)
  } else if (cacheOnly || quotaHit) {
    answers = new Map()
    console.warn('  answer key not cached; skipped')
  } else if (keyImage && existsSync(resolve(keyImage))) {
    const data = readFileSync(resolve(keyImage))
    answers = await readReadingAnswerKey(runner, { mimeType: 'image/jpeg', data, name: keyImage }, testNo)
    writeFileSync(keyFile, JSON.stringify([...answers.entries()]))
  } else if (keyPath && existsSync(resolve(keyPath))) {
    const data = readFileSync(resolve(keyPath))
    answers = await readReadingAnswerKey(runner, { mimeType: 'application/pdf', data, name: keyPath }, testNo)
    writeFileSync(keyFile, JSON.stringify([...answers.entries()]))
  } else {
    throw new Error('Thiếu đáp án: đặt pages/answers.json, hoặc --key <pdf>, hoặc --key-image <jpg>')
  }
  const reading = [...answers.entries()].filter(([n]) => n >= 101 && n <= 200)
  console.log(`  ${reading.length} reading answers (101–200)`)

  const { draft, crops } = await assembleReadingDraft({
    collection,
    testNo,
    models: runner.modelsUsed.length ? runner.modelsUsed : models,
    pages: pages.map((p) => ({
      page: p.page,
      buffer: p.buffer,
      read: reads.find((r) => r.page === p.page)?.read ?? EMPTY,
    })),
    answers: new Map(reading),
  })

  writeFileSync(join(dir, 'draft.json'), JSON.stringify(draft, null, 2))
  for (const c of crops) writeFileSync(join(dir, c.file), c.data)
  console.log(`\nDraft: ${join(dir, 'draft.json')}`)
  console.log(`${draft.questions.length} questions, ${draft.groups.length} groups, ${crops.length} crops`)
  for (const u of runner.usage.values()) console.log(`AI usage ${u.model}: ${u.calls} calls, ${u.promptTokens} in / ${u.outputTokens} out tokens`)
  if (draft.warnings.length) {
    console.log(`\n${draft.warnings.length} warning(s):`)
    for (const w of draft.warnings) console.log(`  - ${w}`)
  } else console.log('No warnings: all automatic checks passed.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
