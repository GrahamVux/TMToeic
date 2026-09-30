/**
 * AI-assisted import of one test's Listening section into a reviewable draft (no database writes).
 *
 *   npm run import:lc -w @toeic/api -- "<ETS 2018.zip>" 7
 *
 * Output: content/drafts/<collection>/test-07/draft.json + cropped Part 1 photos / figures.
 * Needs AI_API_KEY (Gemini) in apps/api/.env. Override models with AI_MODELS=a,b,c.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { loadDotEnv } from '../config/app-config'
import { extractPdfJpegs } from '../importer/pdf-images'
import { groupStripsIntoPages, stitchPage } from '../importer/pdf-pages'
import { loadTestSource } from '../importer/ets-source'
import { assembleListeningDraft, DEFAULT_MODELS, ModelRunner, readAnswerKey, readPage, type PageRead } from '../importer/lc-extract'
import { GeminiError } from '../importer/gemini'

async function pool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

const EMPTY_READ: PageRead = { questions: [], groupHeadings: [], photos: [], graphics: [] }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  loadDotEnv()
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY is not set (apps/api/.env)')
  const models = process.env.AI_MODELS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_MODELS
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const [zipPath, testArg] = args
  const testNo = Number(testArg)
  if (!zipPath || !Number.isInteger(testNo)) throw new Error('Usage: import-lc <zip> <testNo>')
  const collection = 'ets-2018'
  const cacheOnly = process.argv.includes('--cache-only')
  const pageDelayMs = Number(process.env.AI_PAGE_DELAY_MS ?? (process.argv.includes('--slow') ? 25_000 : 0))

  console.log(`Test ${testNo}: loading files from zip…`)
  const src = await loadTestSource(zipPath, testNo, collection)
  if (!src.questionPdfs.length) throw new Error('No question PDF found for this test')
  if (!src.answerImages.length) throw new Error('No answer-key image/PDF found (spreadsheet keys are not supported yet)')

  // Pages: stitch every question PDF (split tests have several).
  const pages: Array<{ page: number; buffer: Buffer; from: string }> = []
  for (const pdf of src.questionPdfs) {
    const strips = extractPdfJpegs(pdf.data)
    for (const group of groupStripsIntoPages(strips)) {
      const stitched = await stitchPage(group)
      if (stitched.height < 1000) continue // stray strip (logo/watermark)
      pages.push({ page: pages.length + 1, buffer: stitched.data, from: pdf.name })
    }
  }
  console.log(`${pages.length} pages from ${src.questionPdfs.length} PDF(s); models: ${models.join(' → ')}${cacheOnly ? ' (cache only, no AI)' : ''}`)

  const dir = resolve('content', 'drafts', collection, `test-${String(testNo).padStart(2, '0')}`)
  mkdirSync(dir, { recursive: true })
  const rawPath = join(dir, 'raw.json')
  type Raw = { models: string[]; pages: Array<{ page: number; read: PageRead }>; answers: Array<[number, 'A' | 'B' | 'C' | 'D']> }

  const runner = new ModelRunner(apiKey, models)
  let raw: Raw
  if (process.argv.includes('--reuse') && existsSync(rawPath)) {
    raw = JSON.parse(readFileSync(rawPath, 'utf8')) as Raw
    console.log(`Re-using saved AI readings from ${rawPath} (no AI calls)`)
  } else {
    let done = 0
    let quotaHit = false
    // Each page is cached as soon as it is read, so a quota error never wastes finished work.
    const cacheDir = join(dir, 'pages')
    mkdirSync(cacheDir, { recursive: true })
    const reads = await pool(pages, 1, async (p) => {
      const cacheFile = join(cacheDir, `p${String(p.page).padStart(2, '0')}.json`)
      let read: PageRead
      if (existsSync(cacheFile)) read = JSON.parse(readFileSync(cacheFile, 'utf8')) as PageRead
      else if (cacheOnly || quotaHit) read = EMPTY_READ
      else {
        if (pageDelayMs > 0) await sleep(pageDelayMs)
        try {
          read = await readPage(runner, p.buffer)
          writeFileSync(cacheFile, JSON.stringify(read))
        } catch (err) {
          if (err instanceof GeminiError && err.status === 429 && /PerDay/i.test(err.message)) {
            quotaHit = true
            console.warn(`  daily quota reached at page ${p.page}; keeping cached pages and stopping AI`)
            read = EMPTY_READ
          } else throw err
        }
      }
      const source = existsSync(cacheFile) ? '' : ' (missing)'
      console.log(`  page ${String(p.page).padStart(2)}/${pages.length}: ${read.questions.length} questions, ${read.photos.length} photos, ${read.graphics.length} graphics [${++done} done]${source}`)
      return { page: p.page, read }
    })
    console.log('Reading the answer key…')
    const keyFile = join(cacheDir, 'answers.json')
    let answers: Map<number, 'A' | 'B' | 'C' | 'D'>
    if (existsSync(keyFile)) answers = new Map(JSON.parse(readFileSync(keyFile, 'utf8')) as Array<[number, 'A' | 'B' | 'C' | 'D']>)
    else if (cacheOnly || quotaHit) {
      answers = new Map()
      console.warn('  answer key not cached; skipped')
    } else {
      if (pageDelayMs > 0) await sleep(pageDelayMs)
      try {
        answers = await readAnswerKey(runner, src.answerImages[0])
        writeFileSync(keyFile, JSON.stringify([...answers.entries()]))
      } catch (err) {
        if (err instanceof GeminiError && err.status === 429 && /PerDay/i.test(err.message)) {
          answers = new Map()
          console.warn('  daily quota reached before the answer key; skipped')
        } else throw err
      }
    }
    console.log(`  ${answers.size} answers`)
    raw = {
      models: runner.modelsUsed,
      pages: reads.filter((r) => existsSync(join(cacheDir, `p${String(r.page).padStart(2, '0')}.json`))),
      answers: [...answers.entries()],
    }
    if (raw.pages.length === pages.length && answers.size) writeFileSync(rawPath, JSON.stringify(raw))
  }

  const readByPage = new Map(raw.pages.map((p) => [p.page, p.read]))
  const { draft, crops } = await assembleListeningDraft({
    collection,
    testNo,
    models: raw.models,
    pages: pages.map((p) => ({ page: p.page, buffer: p.buffer, read: readByPage.get(p.page) ?? EMPTY_READ })),
    answers: new Map(raw.answers),
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
