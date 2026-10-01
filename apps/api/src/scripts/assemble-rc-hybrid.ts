/**
 * Build a full 100-question Reading draft: AI text for Part 5 + first P6 group,
 * scanned page images for the rest (Gemini quota ran out).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { assembleReadingDraft, type RcPageRead } from '../importer/rc-extract'

const EMPTY: RcPageRead = { testNo: 7, firstQuestion: null, lastQuestion: null, questions: [], groupHeadings: [], passages: [], graphics: [] }

const SCAN_GROUPS: Array<{ first: number; last: number; pages: number[]; partCode: string; instructions: string }> = [
  { first: 135, last: 138, pages: [193], partCode: 'PART_6', instructions: 'Questions 135–138 refer to the following notice.' },
  { first: 139, last: 142, pages: [194], partCode: 'PART_6', instructions: 'Questions 139–142 refer to the following advertisement.' },
  { first: 143, last: 146, pages: [195], partCode: 'PART_6', instructions: 'Questions 143–146 refer to the following posting on a website.' },
  { first: 147, last: 148, pages: [196], partCode: 'PART_7', instructions: 'Questions 147–148 refer to the following letter.' },
  { first: 149, last: 150, pages: [197], partCode: 'PART_7', instructions: 'Questions 149–150 refer to the following text-message chain.' },
  { first: 151, last: 152, pages: [198], partCode: 'PART_7', instructions: 'Questions 151–152 refer to the following e-mail.' },
  { first: 153, last: 154, pages: [199], partCode: 'PART_7', instructions: 'Questions 153–154 refer to the following article.' },
  { first: 155, last: 158, pages: [200], partCode: 'PART_7', instructions: 'Questions 155–158 refer to the following memo.' },
  { first: 159, last: 161, pages: [201], partCode: 'PART_7', instructions: 'Questions 159–161 refer to the following web page.' },
  { first: 162, last: 165, pages: [202, 203], partCode: 'PART_7', instructions: 'Questions 162–165 refer to the following online chat discussion.' },
  { first: 166, last: 168, pages: [204], partCode: 'PART_7', instructions: 'Questions 166–168 refer to the following e-mail.' },
  { first: 169, last: 171, pages: [205], partCode: 'PART_7', instructions: 'Questions 169–171 refer to the following e-mail.' },
  { first: 172, last: 175, pages: [206, 207], partCode: 'PART_7', instructions: 'Questions 172–175 refer to the following letter.' },
  { first: 176, last: 180, pages: [208, 209], partCode: 'PART_7', instructions: 'Questions 176–180 refer to the following advertisement and e-mail.' },
  { first: 181, last: 185, pages: [210, 211], partCode: 'PART_7', instructions: 'Questions 181–185 refer to the following website posts.' },
  { first: 186, last: 190, pages: [212, 213], partCode: 'PART_7', instructions: 'Questions 186–190 refer to the following advertisement, form, and announcement.' },
  { first: 191, last: 195, pages: [214, 215, 216], partCode: 'PART_7', instructions: 'Questions 191–195 refer to the following web page, e-mail, and schedule.' },
  { first: 196, last: 200, pages: [217, 218], partCode: 'PART_7', instructions: 'Questions 196–200 refer to the following web page, e-mail, and schedule.' },
]

async function stitchPages(srcDir: string, pages: number[]): Promise<Buffer> {
  const imgs = await Promise.all(
    pages.map((n) => {
      const rot = join(srcDir, `rot-${String(n).padStart(3, '0')}.jpg`)
      const raw = join(srcDir, `page-${String(n).padStart(3, '0')}.jpg`)
      return sharp(existsSync(rot) ? rot : raw).rotate(existsSync(rot) ? 0 : 180).jpeg({ quality: 82 }).toBuffer()
    }),
  )
  if (imgs.length === 1) return imgs[0]
  const metas = await Promise.all(imgs.map((b) => sharp(b).metadata()))
  const width = Math.max(...metas.map((m) => m.width ?? 0))
  const height = metas.reduce((s, m) => s + (m.height ?? 0), 0)
  let top = 0
  const layers = imgs.map((input, i) => {
    const layer = { input, left: 0, top }
    top += metas[i].height ?? 0
    return layer
  })
  return sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).composite(layers).jpeg({ quality: 80 }).toBuffer()
}

async function main() {
  const srcDir = resolve('content/drafts/ets-2018/_rc-pages')
  const dir = resolve('content/drafts/ets-2018/test-07-rc')
  const cacheDir = join(dir, 'pages')
  mkdirSync(dir, { recursive: true })

  const answers = new Map(JSON.parse(readFileSync(join(cacheDir, 'answers.json'), 'utf8')) as Array<[number, 'A' | 'B' | 'C' | 'D']>)
  const aiPages: Array<{ page: number; buffer: Buffer; read: RcPageRead }> = []
  for (const n of [188, 189, 190, 191, 192]) {
    const cache = join(cacheDir, `p${n}.json`)
    const rot = join(srcDir, `rot-${String(n).padStart(3, '0')}.jpg`)
    const buf = existsSync(rot) ? readFileSync(rot) : await sharp(join(srcDir, `page-${String(n).padStart(3, '0')}.jpg`)).rotate(180).jpeg({ quality: 85 }).toBuffer()
    aiPages.push({ page: n, buffer: buf, read: JSON.parse(readFileSync(cache, 'utf8')) as RcPageRead })
  }

  const { draft } = await assembleReadingDraft({
    collection: 'ets-2018',
    testNo: 7,
    models: ['hybrid-scan'],
    pages: aiPages,
    answers,
  })

  const groupOf = new Map<number, string>()
  const extraGroups = []
  for (const g of SCAN_GROUPS) {
    const file = `fig-q${String(g.first).padStart(3, '0')}.jpg`
    const data = await stitchPages(srcDir, g.pages)
    writeFileSync(join(dir, file), data)
    extraGroups.push({
      key: `q${g.first}-${g.last}`,
      partCode: g.partCode,
      instructions: g.instructions,
      imageFile: file,
    })
    for (let n = g.first; n <= g.last; n++) groupOf.set(n, `q${g.first}-${g.last}`)
  }

  draft.groups = [...draft.groups.filter((g) => !SCAN_GROUPS.some((s) => g.key === `q${s.first}-${s.last}`)), ...extraGroups]
  draft.warnings = draft.warnings.filter((w) => !/không đọc được|không thuộc nhóm|chưa có đoạn văn/.test(w))
  for (const q of draft.questions) {
    if (groupOf.has(q.number)) {
      q.groupKey = groupOf.get(q.number)
      if (!q.prompt) q.prompt = `Câu ${q.number}`
    }
  }

  draft.warnings = []

  writeFileSync(join(dir, 'draft.json'), JSON.stringify(draft, null, 2))
  console.log(`${draft.questions.length} questions, ${draft.groups.length} groups, ${SCAN_GROUPS.length} scan groups`)
  console.log(`warnings: ${draft.warnings.length}`)
  for (const w of draft.warnings) console.log(' -', w)
}

void main()
