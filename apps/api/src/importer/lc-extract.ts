import sharp from 'sharp'
import { generateJson, GeminiError, inlineFile } from './gemini'
import { LISTENING_LAYOUT, optionKeysFor, partOfQuestion, type Draft, type DraftGroup, type DraftQuestion } from './draft'

const STR = { type: 'STRING' }
const INT = { type: 'INTEGER' }
const INTS = { type: 'ARRAY', items: INT }

export type PageRead = {
  questions: Array<{ number: number; prompt: string; options: Array<{ key: string; text: string }> }>
  groupHeadings: Array<{ first: number; last: number; text: string }>
  photos: Array<{ questionNumber: number; box: number[] }>
  graphics: Array<{ description: string; questionNumbers: number[]; box: number[] }>
}

const PAGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { number: INT, prompt: STR, options: { type: 'ARRAY', items: { type: 'OBJECT', properties: { key: STR, text: STR }, required: ['key', 'text'] } } },
        required: ['number', 'prompt', 'options'],
      },
    },
    groupHeadings: { type: 'ARRAY', items: { type: 'OBJECT', properties: { first: INT, last: INT, text: STR }, required: ['first', 'last', 'text'] } },
    photos: { type: 'ARRAY', items: { type: 'OBJECT', properties: { questionNumber: INT, box: INTS }, required: ['questionNumber', 'box'] } },
    graphics: { type: 'ARRAY', items: { type: 'OBJECT', properties: { description: STR, questionNumbers: INTS, box: INTS }, required: ['description', 'questionNumbers', 'box'] } },
  },
  required: ['questions', 'groupHeadings', 'photos', 'graphics'],
}

const PAGE_PROMPT = `You are digitising a scanned page of a TOEIC Listening test paper. Return ONLY what is printed on this page.

1. "questions": every numbered question that has printed text. For each: its number as printed; "prompt" = the question text exactly as printed (keep punctuation, capitalisation, numbers, currency; do not fix typos); "options" = each printed choice with key "A".."D" and its text WITHOUT the "(A)" marker. Part 1 (photographs) and Part 2 (question-response) have no printed question or choice text: return NO entries for them.
2. "groupHeadings": every heading like "Questions 32 through 34 refer to the following conversation." with first, last and the heading text exactly as printed.
3. "photos": Part 1 photographs that are labelled with a question number 1-6 (NOT the sample/example photograph). box = tight bounding box of the photograph only, as [ymin, xmin, ymax, xmax] normalised to 0-1000 over the full page.
4. "graphics": any chart, table, map, schedule, sign, voucher, floor plan, or similar figure that the questions refer to (questions that say "Look at the graphic"). box = tight bounding box of the figure only (no question text), [ymin, xmin, ymax, xmax] normalised to 0-1000. questionNumbers = the questions that refer to it. description = one short sentence.

Ignore page headers/footers, watermarks, running titles such as "New Economy TOEIC LC 1000", "Actual Test 07", "GO ON TO THE NEXT PAGE", and page numbers. If the page has none of a category, return an empty array for it. Never invent content that is not visible.`

/** Models tried in order; the newest are sometimes overloaded (503) or not offered to every account (404). */
export const DEFAULT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.8-flash']

export type ModelUse = { model: string; calls: number; promptTokens: number; outputTokens: number }

export class ModelRunner {
  readonly usage = new Map<string, ModelUse>()
  private readonly quotaExhausted = new Set<string>()
  constructor(
    private readonly apiKey: string,
    private readonly models: string[],
  ) {}

  get modelsUsed() {
    return [...this.usage.keys()]
  }

  async json<T>(parts: Parameters<typeof generateJson>[0]['parts'], schema: Record<string, unknown>): Promise<T> {
    let last: unknown
    for (const model of this.models) {
      if (this.quotaExhausted.has(model)) continue
      try {
        const { data, usage } = await generateJson<T>({ apiKey: this.apiKey, model, parts, schema })
        const u = this.usage.get(model) ?? { model, calls: 0, promptTokens: 0, outputTokens: 0 }
        u.calls++
        u.promptTokens += usage.promptTokens
        u.outputTokens += usage.outputTokens + usage.thinkingTokens
        this.usage.set(model, u)
        return data
      } catch (err) {
        last = err
        // Daily quota only — a "Please retry in Ns" 429 is per-minute and generateJson already waited.
        if (err instanceof GeminiError && err.status === 429 && /PerDay|free_tier_requests/i.test(err.message)) this.quotaExhausted.add(model)
        // Per-minute 429 already waited inside generateJson — falling through to more models burns the quota.
        if (err instanceof GeminiError && err.status === 429 && !/PerDay|free_tier_requests/i.test(err.message)) throw err
        if (err instanceof GeminiError && (err.status === 404 || err.status === 429 || err.status >= 500 || err.status === 200)) continue
        throw err
      }
    }
    throw last instanceof Error ? last : new Error('All models failed')
  }
}

export async function readPage(runner: ModelRunner, pageJpeg: Buffer): Promise<PageRead> {
  const small = await sharp(pageJpeg).resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  return runner.json<PageRead>([inlineFile('image/jpeg', small), { text: PAGE_PROMPT }], PAGE_SCHEMA)
}

export async function readAnswerKey(runner: ModelRunner, image: { mimeType: string; data: Buffer }): Promise<Map<number, 'A' | 'B' | 'C' | 'D'>> {
  const out = await runner.json<{ answers: Array<{ number: number; answer: string }> }>(
    [
      inlineFile(image.mimeType, image.data),
      {
        text: 'This is an answer key for a TOEIC Listening test. Transcribe every question number with its correct answer letter (A, B, C or D), exactly as printed (format like "12 (B)"). Include only entries that are printed and legible; do not guess missing ones.',
      },
    ],
    { type: 'OBJECT', properties: { answers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { number: INT, answer: STR }, required: ['number', 'answer'] } } }, required: ['answers'] },
  )
  const map = new Map<number, 'A' | 'B' | 'C' | 'D'>()
  for (const a of out.answers) {
    const letter = a.answer.trim().toUpperCase().replace(/[^A-D]/g, '')
    if (letter.length === 1 && !map.has(a.number)) map.set(a.number, letter as 'A' | 'B' | 'C' | 'D')
  }
  return map
}

export type Crop = { file: string; data: Buffer }

/** Crop a normalised [ymin,xmin,ymax,xmax] (0-1000) box out of a page, with a little padding. */
export async function cropBox(page: Buffer, box: number[], file: string): Promise<Crop | null> {
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v))) return null
  const meta = await sharp(page).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v)))
  if (ymax - ymin < 20 || xmax - xmin < 20) return null
  const pad = 8
  const left = Math.max(0, Math.round((xmin / 1000) * W) - pad)
  const top = Math.max(0, Math.round((ymin / 1000) * H) - pad)
  const width = Math.min(W - left, Math.round(((xmax - xmin) / 1000) * W) + pad * 2)
  const height = Math.min(H - top, Math.round(((ymax - ymin) / 1000) * H) + pad * 2)
  const data = await sharp(page).extract({ left, top, width, height }).jpeg({ quality: 88 }).toBuffer()
  return { file, data }
}

export type AssembleInput = {
  collection: string
  testNo: number
  models: string[]
  pages: Array<{ page: number; buffer: Buffer; read: PageRead }>
  answers: Map<number, 'A' | 'B' | 'C' | 'D'>
}

/** Turns per-page readings into a Draft + crops, recording every doubt as a warning. */
export async function assembleListeningDraft(input: AssembleInput): Promise<{ draft: Draft; crops: Crop[] }> {
  const warnings: string[] = []
  const crops: Crop[] = []
  const byNumber = new Map<number, { q: PageRead['questions'][number]; page: number }>()
  const headings = new Map<string, { first: number; last: number; text: string; page: number }>()
  const figureFor = new Map<number, string>() // question number -> crop file (group figure)
  const photoFor = new Map<number, string>()

  for (const { page, buffer, read } of input.pages) {
    for (const q of read.questions) {
      if (partOfQuestion(q.number) === null) continue // e.g. a stray reading of a sample question
      if (byNumber.has(q.number)) warnings.push(`Câu ${q.number} xuất hiện trên nhiều trang (giữ bản đầu, trang ${byNumber.get(q.number)!.page})`)
      else byNumber.set(q.number, { q, page })
    }
    for (const h of read.groupHeadings) headings.set(`${h.first}-${h.last}`, { ...h, page })
    for (const p of read.photos) {
      if (p.questionNumber < 1 || p.questionNumber > 6) continue
      const file = `q${String(p.questionNumber).padStart(3, '0')}.jpg`
      const crop = await cropBox(buffer, p.box, file)
      if (!crop) warnings.push(`Câu ${p.questionNumber}: không cắt được ảnh (khung ${JSON.stringify(p.box)}, trang ${page})`)
      else {
        crops.push(crop)
        photoFor.set(p.questionNumber, file)
      }
    }
    for (const g of read.graphics) {
      const nums = [...g.questionNumbers].sort((a, b) => a - b)
      if (!nums.length) continue
      const file = `fig-q${String(nums[0]).padStart(3, '0')}.jpg`
      const crop = await cropBox(buffer, g.box, file)
      if (!crop) warnings.push(`Hình cho câu ${nums.join(', ')}: không cắt được (khung ${JSON.stringify(g.box)}, trang ${page})`)
      else {
        crops.push(crop)
        for (const n of nums) figureFor.set(n, file)
      }
    }
  }

  // The printed test paper does not repeat "Questions X through Y refer to…" (it is only spoken), so groups follow the
  // fixed 2018 layout: Part 3 = conversations of 3 questions from Q32, Part 4 = talks of 3 questions from Q71.
  // A printed heading, if the scan has one, only supplies the wording.
  const groups: DraftGroup[] = []
  const groupOfQuestion = new Map<number, string>()
  for (const [partCode, kind] of [['PART_3', 'conversation'], ['PART_4', 'talk']] as const) {
    const part = LISTENING_LAYOUT.find((p) => p.partCode === partCode)!
    for (let first = part.questionStart; first <= part.questionEnd; first += 3) {
      const last = Math.min(first + 2, part.questionEnd)
      const key = `q${first}-${last}`
      const printed = [...headings.values()].find((h) => h.first === first)
      const figure = [...Array(last - first + 1).keys()].map((i) => figureFor.get(first + i)).find(Boolean)
      groups.push({
        key,
        partCode,
        instructions: printed?.text.trim() || `Questions ${first} through ${last} refer to the following ${kind}.`,
        ...(figure ? { imageFile: figure } : {}),
      })
      for (let n = first; n <= last; n++) groupOfQuestion.set(n, key)
    }
  }

  const questions: DraftQuestion[] = []
  for (const part of LISTENING_LAYOUT) {
    const keys = optionKeysFor(part.partCode)
    for (let n = part.questionStart; n <= part.questionEnd; n++) {
      const read = byNumber.get(n)?.q
      const printed = part.partCode === 'PART_3' || part.partCode === 'PART_4'
      let options = keys.map((key) => ({ key, text: '' }))
      let prompt = ''
      if (printed) {
        if (!read) warnings.push(`Câu ${n}: không đọc được từ PDF`)
        else {
          prompt = read.prompt.trim()
          const got = new Map(read.options.map((o) => [o.key.trim().toUpperCase().replace(/[^A-D]/g, ''), o.text.trim()]))
          options = keys.map((key) => ({ key, text: got.get(key) ?? '' }))
          for (const key of keys) if (!got.get(key)) warnings.push(`Câu ${n}: thiếu nội dung đáp án ${key}`)
          if (!prompt) warnings.push(`Câu ${n}: không có nội dung câu hỏi`)
        }
        if (!groupOfQuestion.has(n)) warnings.push(`Câu ${n}: không thuộc nhóm nào ("Questions X through Y refer to…")`)
      } else if (part.partCode === 'PART_1' && !photoFor.has(n)) warnings.push(`Câu ${n}: chưa có ảnh Part 1`)

      const answer = input.answers.get(n) ?? null
      if (!answer) warnings.push(`Câu ${n}: không có đáp án trong bảng đáp án`)
      else if (!keys.includes(answer)) warnings.push(`Câu ${n}: đáp án ${answer} không hợp lệ cho ${part.partCode}`)

      questions.push({
        number: n,
        partCode: part.partCode,
        prompt,
        options,
        answer: answer && keys.includes(answer) ? answer : null,
        ...(groupOfQuestion.has(n) ? { groupKey: groupOfQuestion.get(n) } : {}),
        ...(photoFor.has(n) ? { imageFile: photoFor.get(n) } : {}),
      })
    }
  }

  // A graphic mentioned for a question that no heading group covers would be silently dropped otherwise.
  for (const [n, file] of figureFor) {
    if (!groupOfQuestion.has(n)) warnings.push(`Hình ${file} (câu ${n}) không gắn được vào nhóm nào`)
  }

  const testNo = String(input.testNo).padStart(2, '0')
  return {
    crops: [...new Map(crops.map((c) => [c.file, c])).values()],
    draft: {
      schemaVersion: 1,
      source: { collection: input.collection, testNo: input.testNo, models: input.models, generatedAt: new Date().toISOString() },
      exam: {
        code: `${input.collection.toUpperCase()}-T${testNo}-LC`,
        title: `ETS 2018 – Test ${testNo} (Listening)`,
        durationSeconds: 45 * 60,
        parts: LISTENING_LAYOUT.map((p) => ({ ...p })),
      },
      groups,
      questions,
      warnings,
    },
  }
}
