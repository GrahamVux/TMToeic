import sharp from 'sharp'
import { filePart, inlineFile, uploadGeminiFile } from './gemini'
import { cropBox, DEFAULT_MODELS, ModelRunner, type Crop } from './lc-extract'
import {
  optionKeysFor,
  partOfReadingQuestion,
  READING_LAYOUT,
  type Draft,
  type DraftGroup,
  type DraftPassage,
  type DraftQuestion,
} from './draft'

const STR = { type: 'STRING' }
const INT = { type: 'INTEGER' }
const INTS = { type: 'ARRAY', items: INT }

export { DEFAULT_MODELS, ModelRunner }

export type RcPageRead = {
  testNo: number | null
  firstQuestion: number | null
  lastQuestion: number | null
  questions: Array<{ number: number; prompt: string; options: Array<{ key: string; text: string }> }>
  groupHeadings: Array<{ first: number; last: number; text: string }>
  passages: Array<{ label: string; title: string; content: string; questionNumbers: number[] }>
  graphics: Array<{ description: string; questionNumbers: number[]; box: number[] }>
}

const PAGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    testNo: { type: 'INTEGER', nullable: true },
    firstQuestion: { type: 'INTEGER', nullable: true },
    lastQuestion: { type: 'INTEGER', nullable: true },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          number: INT,
          prompt: STR,
          options: { type: 'ARRAY', items: { type: 'OBJECT', properties: { key: STR, text: STR }, required: ['key', 'text'] } },
        },
        required: ['number', 'prompt', 'options'],
      },
    },
    groupHeadings: { type: 'ARRAY', items: { type: 'OBJECT', properties: { first: INT, last: INT, text: STR }, required: ['first', 'last', 'text'] } },
    passages: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { label: STR, title: STR, content: STR, questionNumbers: INTS },
        required: ['label', 'title', 'content', 'questionNumbers'],
      },
    },
    graphics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { description: STR, questionNumbers: INTS, box: INTS },
        required: ['description', 'questionNumbers', 'box'],
      },
    },
  },
  required: ['questions', 'groupHeadings', 'passages', 'graphics'],
}

const PAGE_PROMPT = `You are digitising a scanned page of a TOEIC Reading test (Parts 5–7, questions 101–200). Return ONLY what is printed on this page.

1. "testNo": the Actual Test number printed in the header (e.g. 7 from "Actual Test 07"). null if none.
2. "firstQuestion" / "lastQuestion": smallest and largest question numbers printed on this page (null if none).
3. "questions": every numbered question 101–200 with printed choices. prompt = the question stem exactly as printed (keep punctuation; do not fix typos). For Part 6 blanks like (131), prompt may be empty or the blank number. options = A–D texts WITHOUT the "(A)" marker.
4. "groupHeadings": headings like "Questions 147-149 refer to the following e-mail." with first, last, and the heading text exactly as printed.
5. "passages": each reading text / email / notice / article / form on the page. label = "A"/"B"/"C" as printed (or "A" if only one). title = a short type (Email, Notice, Article, Form, Advertisement, Text message…). content = the FULL passage text, preserving line breaks; for Part 6 keep the blanks as (131) ______. questionNumbers = the questions that belong to this text. If a passage continues from a previous page, still transcribe everything visible here.
6. "graphics": chart, table, map, schedule, coupon, invoice, or similar figure. box = tight bounding box of the figure only as [ymin, xmin, ymax, xmax] normalised to 0-1000. questionNumbers = questions that refer to it.

Ignore headers/footers/watermarks ("New Economy TOEIC RC 1000", "GO ON TO THE NEXT PAGE", page numbers). Never invent content that is not visible. Empty arrays if a category is absent.`

const META_SCHEMA = {
  type: 'OBJECT',
  properties: {
    testNo: { type: 'INTEGER', nullable: true },
    firstQuestion: { type: 'INTEGER', nullable: true },
    lastQuestion: { type: 'INTEGER', nullable: true },
    kind: STR,
  },
  required: ['kind'],
}

export async function readRcPage(runner: ModelRunner, pageJpeg: Buffer): Promise<RcPageRead> {
  const small = await sharp(pageJpeg).resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  const data = await runner.json<RcPageRead>([inlineFile('image/jpeg', small), { text: PAGE_PROMPT }], PAGE_SCHEMA)
  return {
    testNo: data.testNo ?? null,
    firstQuestion: data.firstQuestion ?? null,
    lastQuestion: data.lastQuestion ?? null,
    questions: data.questions ?? [],
    groupHeadings: data.groupHeadings ?? [],
    passages: data.passages ?? [],
    graphics: data.graphics ?? [],
  }
}

export async function readRcPageMeta(
  runner: ModelRunner,
  pageJpeg: Buffer,
): Promise<{ testNo: number | null; firstQuestion: number | null; lastQuestion: number | null; kind: string }> {
  const thumb = await sharp(pageJpeg).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
  return runner.json([
    inlineFile('image/jpeg', thumb),
    {
      text: 'This is one page of a TOEIC Reading book. Report the Actual Test number in the header (null if none), the first and last question numbers printed (null if none), and kind = one of cover, directions, part5, part6, part7, answerkey, other. Do not transcribe the full text.',
    },
  ], META_SCHEMA)
}

function letterOf(raw: string): 'A' | 'B' | 'C' | 'D' | null {
  const letter = raw.trim().toUpperCase().replace(/[^A-D]/g, '')
  return letter.length === 1 ? (letter as 'A' | 'B' | 'C' | 'D') : null
}

export async function readReadingAnswerKey(
  runner: ModelRunner,
  source: { mimeType: string; data: Buffer; name?: string },
  testNo: number,
): Promise<Map<number, 'A' | 'B' | 'C' | 'D'>> {
  const schema = {
    type: 'OBJECT',
    properties: {
      tests: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            testNo: INT,
            answers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { number: INT, answer: STR }, required: ['number', 'answer'] } },
          },
          required: ['testNo', 'answers'],
        },
      },
    },
    required: ['tests'],
  }
  const prompt = `This file is an answer key for TOEIC test(s). Transcribe every printed question number with its correct letter (A–D). Group by Actual Test / Test number when the page shows one. Include Reading items 101–200 when present. Do not guess missing entries. Format like "101 (B)".`

  const useFile = source.mimeType === 'application/pdf' && source.data.length > 4_000_000
  const send = useFile
    ? [
        filePart(
          source.mimeType,
          (await uploadGeminiFile(process.env.AI_API_KEY ?? '', source.mimeType, source.data, source.name ?? 'key.pdf')).uri,
        ),
        { text: prompt },
      ]
    : [inlineFile(source.mimeType, source.data), { text: prompt }]

  const out = await runner.json<{ tests: Array<{ testNo: number; answers: Array<{ number: number; answer: string }> }> }>(send, schema)
  const wanted = out.tests.find((t) => t.testNo === testNo) ?? (out.tests.length === 1 ? out.tests[0] : undefined)
  const pool = wanted?.answers ?? out.tests.flatMap((t) => t.answers)
  const map = new Map<number, 'A' | 'B' | 'C' | 'D'>()
  const all = new Map<number, 'A' | 'B' | 'C' | 'D'>()
  for (const a of pool) {
    const letter = letterOf(a.answer)
    if (!letter || all.has(a.number)) continue
    all.set(a.number, letter)
    if (a.number >= 101 && a.number <= 200) map.set(a.number, letter)
  }
  if (!map.size && all.size) {
    // Some keys only print 1–100 even for a Reading sheet; keep them so the caller can inspect.
    for (const [n, letter] of all) map.set(n, letter)
  }
  return map
}

function mergePassage(a: DraftPassage | undefined, b: DraftPassage): DraftPassage {
  if (!a) return b
  const gap = a.content && b.content && !a.content.endsWith('\n') ? '\n' : ''
  return {
    label: a.label || b.label,
    title: a.title || b.title,
    content: `${a.content}${gap}${b.content}`.replace(/\n{3,}/g, '\n\n').trim(),
  }
}

export type AssembleReadingInput = {
  collection: string
  testNo: number
  models: string[]
  pages: Array<{ page: number; buffer: Buffer; read: RcPageRead }>
  answers: Map<number, 'A' | 'B' | 'C' | 'D'>
}

export async function assembleReadingDraft(input: AssembleReadingInput): Promise<{ draft: Draft; crops: Crop[] }> {
  const warnings: string[] = []
  const crops: Crop[] = []
  const byNumber = new Map<number, { q: RcPageRead['questions'][number]; page: number }>()
  const headings = new Map<string, { first: number; last: number; text: string }>()
  const figureFor = new Map<number, string>()
  const passagesByRange = new Map<string, DraftPassage[]>()

  for (const { page, buffer, read } of input.pages) {
    for (const q of read.questions) {
      if (partOfReadingQuestion(q.number) === null) continue
      if (byNumber.has(q.number)) warnings.push(`Câu ${q.number} xuất hiện trên nhiều trang (giữ bản đầu, trang ${byNumber.get(q.number)!.page})`)
      else byNumber.set(q.number, { q, page })
    }
    for (const h of read.groupHeadings) {
      if (h.first < 101 || h.last > 200) continue
      headings.set(`${h.first}-${h.last}`, { first: h.first, last: h.last, text: h.text })
    }
    for (const p of read.passages) {
      const nums = [...p.questionNumbers].filter((n) => partOfReadingQuestion(n)).sort((a, b) => a - b)
      if (!p.content.trim()) continue
      const key = nums.length ? `${nums[0]}-${nums[nums.length - 1]}` : `page-${page}-${p.label}`
      const next: DraftPassage = { label: (p.label || 'A').slice(0, 4), title: p.title || undefined, content: p.content.trim() }
      const cur = passagesByRange.get(key) ?? []
      const same = cur.findIndex((x) => x.label === next.label)
      if (same >= 0) cur[same] = mergePassage(cur[same], next)
      else cur.push(next)
      passagesByRange.set(key, cur)
    }
    for (const g of read.graphics) {
      const nums = [...g.questionNumbers].filter((n) => partOfReadingQuestion(n)).sort((a, b) => a - b)
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

  const groups: DraftGroup[] = []
  const groupOfQuestion = new Map<number, string>()

  const addGroup = (first: number, last: number, partCode: string, instructions: string, passages: DraftPassage[]) => {
    const key = `q${first}-${last}`
    const figure = [...Array(last - first + 1).keys()].map((i) => figureFor.get(first + i)).find(Boolean)
    groups.push({
      key,
      partCode,
      instructions,
      ...(figure ? { imageFile: figure } : {}),
      ...(passages.length ? { passages } : {}),
    })
    for (let n = first; n <= last; n++) groupOfQuestion.set(n, key)
  }

  const p6 = READING_LAYOUT.find((p) => p.partCode === 'PART_6')!
  for (let first = p6.questionStart; first <= p6.questionEnd; first += 4) {
    const last = Math.min(first + 3, p6.questionEnd)
    const printed = [...headings.values()].find((h) => h.first === first)
    const passages = passagesByRange.get(`${first}-${last}`) ?? []
    addGroup(first, last, 'PART_6', printed?.text.trim() || `Questions ${first}-${last} refer to the following text.`, passages)
    if (!passages.length) warnings.push(`Part 6 ${first}-${last}: chưa có đoạn văn`)
  }

  const claimed = new Set<number>()
  for (const n of groupOfQuestion.keys()) claimed.add(n)

  const p7ranges = [...headings.values()]
    .filter((h) => h.first >= 147)
    .sort((a, b) => a.first - b.first)
  const extraRanges = [...passagesByRange.keys()]
    .map((k) => {
      const m = /^(\d+)-(\d+)$/.exec(k)
      return m ? { first: Number(m[1]), last: Number(m[2]) } : null
    })
    .filter((r): r is { first: number; last: number } => !!r && r.first >= 147)

  const ranges: Array<{ first: number; last: number; text: string }> = p7ranges.map((h) => ({ first: h.first, last: h.last, text: h.text }))
  for (const r of extraRanges) {
    if (ranges.some((x) => x.first === r.first && x.last === r.last)) continue
    if (ranges.some((x) => r.first >= x.first && r.last <= x.last)) continue
    ranges.push({ first: r.first, last: r.last, text: `Questions ${r.first}-${r.last} refer to the following text.` })
  }
  ranges.sort((a, b) => a.first - b.first)

  for (const r of ranges) {
    if (r.last < r.first) continue
    const passages =
      passagesByRange.get(`${r.first}-${r.last}`) ??
      [...passagesByRange.entries()]
        .filter(([k]) => {
          const m = /^(\d+)-(\d+)$/.exec(k)
          return m ? Number(m[1]) >= r.first && Number(m[2]) <= r.last : false
        })
        .flatMap(([, v]) => v)
    addGroup(r.first, r.last, partOfReadingQuestion(r.first) ?? 'PART_7', r.text.trim(), passages)
    if (!passages.length) warnings.push(`Câu ${r.first}-${r.last}: chưa có đoạn văn`)
  }

  const questions: DraftQuestion[] = []
  for (const part of READING_LAYOUT) {
    const keys = optionKeysFor(part.partCode)
    for (let n = part.questionStart; n <= part.questionEnd; n++) {
      const read = byNumber.get(n)?.q
      if (!read) warnings.push(`Câu ${n}: không đọc được từ PDF`)
      const got = new Map((read?.options ?? []).map((o) => [o.key.trim().toUpperCase().replace(/[^A-D]/g, ''), o.text.trim()]))
      const options = keys.map((key) => ({ key, text: got.get(key) ?? '' }))
      for (const key of keys) if (read && !got.get(key)) warnings.push(`Câu ${n}: thiếu nội dung đáp án ${key}`)
      if (read && part.partCode === 'PART_5' && !read.prompt.trim()) warnings.push(`Câu ${n}: không có nội dung câu hỏi`)
      if (part.partCode !== 'PART_5' && !groupOfQuestion.has(n)) warnings.push(`Câu ${n}: không thuộc nhóm đoạn văn nào`)

      const answer = input.answers.get(n) ?? null
      if (!answer) warnings.push(`Câu ${n}: không có đáp án trong bảng đáp án`)
      else if (!keys.includes(answer)) warnings.push(`Câu ${n}: đáp án ${answer} không hợp lệ cho ${part.partCode}`)

      questions.push({
        number: n,
        partCode: part.partCode,
        prompt: read?.prompt.trim() ?? '',
        options,
        answer: answer && keys.includes(answer) ? answer : null,
        ...(groupOfQuestion.has(n) ? { groupKey: groupOfQuestion.get(n) } : {}),
      })
    }
  }

  const testNo = String(input.testNo).padStart(2, '0')
  return {
    crops: [...new Map(crops.map((c) => [c.file, c])).values()],
    draft: {
      schemaVersion: 1,
      source: { collection: input.collection, testNo: input.testNo, models: input.models, generatedAt: new Date().toISOString() },
      exam: {
        code: `${input.collection.toUpperCase()}-T${testNo}-RC`,
        title: `ETS 2018 – Test ${testNo} (Reading)`,
        durationSeconds: 75 * 60,
        parts: READING_LAYOUT.map((p) => ({ ...p })),
      },
      groups,
      questions,
      warnings,
    },
  }
}
