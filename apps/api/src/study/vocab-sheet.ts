import ExcelJS from 'exceljs'

export type VocabRow = { word: string; partOfSpeech: string; meaning: string; unit: number | null }

const WORD_HEADERS = new Set(['tu vung', 'vocabulary', 'word', 'vocab', 'tu'])
const POS_HEADERS = new Set(['loai tu', 'tu loai', 'part of speech', 'pos', 'word class', 'loai'])
const MEANING_HEADERS = new Set(['nghia', 'meaning', 'definition', 'nghia tieng viet'])
const SET_LABELS = new Set(['bo de', 'bo tu', 'bo tu vung', 'ten bo', 'ten bo tu', 'ten bo de'])
const TOPIC_LABELS = new Set(['chu de', 'topic', 'chuyen de'])
const UNIT_LABELS = new Set(['unit', 'tap'])

export class VocabSheetError extends Error {}

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  if (value instanceof Date) return ''
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? '').join('').trim()
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text.trim()
  if (typeof value === 'object' && 'result' in value) return cellText(value.result as ExcelJS.CellValue)
  return ''
}

function columnsOf(header: string[]) {
  const folded = header.map(fold)
  const word = folded.findIndex((cell) => WORD_HEADERS.has(cell))
  const meaning = folded.findIndex((cell) => MEANING_HEADERS.has(cell))
  const pos = folded.findIndex((cell) => POS_HEADERS.has(cell))
  if (word >= 0 && meaning >= 0) return { word, pos: pos >= 0 ? pos : -1, meaning, header: true }
  return { word: 0, pos: 1, meaning: 2, header: false }
}

function unitNumber(line: string[]) {
  const at = line.findIndex((cell) => UNIT_LABELS.has(fold(cell)))
  if (at < 0) return null
  for (const cell of line.slice(at + 1)) {
    if (!/^\d+$/.test(cell)) continue
    const value = Number(cell)
    if (value >= 1 && value <= 500) return value
  }
  return null
}

function labelValue(line: string[], labels: Set<string>) {
  const cells = line.map((cell, index) => ({ cell, index })).filter((item) => item.cell)
  if (cells.length < 2 || !labels.has(fold(cells[0]?.cell ?? ''))) return null
  return cells[1]?.cell ?? null
}

export type VocabSheet = { rows: VocabRow[]; skipped: number; title: string | null; topic: string | null; structured: boolean }

/** Read the first worksheet. A plain sheet is word, part of speech, meaning. A sample sheet names the set and each unit. */
export async function readVocabSheet(raw: Buffer): Promise<VocabSheet> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(raw as unknown as ExcelJS.Buffer)
  } catch {
    throw new VocabSheetError('Không đọc được file Excel. Hãy dùng định dạng .xlsx.')
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new VocabSheetError('File Excel không có trang tính nào.')

  const grid: string[][] = []
  sheet.eachRow((row) => {
    const width = Math.max(row.cellCount, 3)
    grid.push(Array.from({ length: width }, (_, index) => cellText(row.getCell(index + 1).value)))
  })
  if (grid.length === 0) throw new VocabSheetError('File không có dòng từ vựng nào.')

  const structured = grid.some((line) => labelValue(line, SET_LABELS) || labelValue(line, TOPIC_LABELS) || unitNumber(line) != null)
  const map = columnsOf(grid[0] ?? [])
  const rows: VocabRow[] = []
  let skipped = 0
  let title: string | null = null
  let topic: string | null = null
  let currentUnit: number | null = structured ? 1 : null
  let columns = map.header ? { word: map.word, pos: map.pos, meaning: map.meaning } : null
  const seen = new Set<string>()
  for (const line of grid) {
    const setName = labelValue(line, SET_LABELS)
    if (setName) {
      title ??= setName.slice(0, 120)
      continue
    }
    const topicName = labelValue(line, TOPIC_LABELS)
    if (topicName) {
      topic ??= topicName.slice(0, 80)
      continue
    }
    const marked = unitNumber(line)
    if (marked != null) {
      currentUnit = marked
      continue
    }
    const header = columnsOf(line)
    if (header.header) {
      columns = { word: header.word, pos: header.pos, meaning: header.meaning }
      continue
    }
    if (structured && !columns) continue
    const used = columns ?? { word: 0, pos: 1, meaning: 2 }
    if (rows.length >= 2000) {
      skipped++
      continue
    }
    const word = (line[used.word] ?? '').trim()
    const partOfSpeech = (used.pos >= 0 ? line[used.pos] ?? '' : '').trim()
    const meaning = (line[used.meaning] ?? '').trim()
    if (!word && !partOfSpeech && !meaning) continue
    if (!word || !partOfSpeech || !meaning || word.length > 80 || partOfSpeech.length > 40 || meaning.length > 500) {
      skipped++
      continue
    }
    const key = `${word.toLowerCase()}\0${partOfSpeech.toLowerCase()}`
    if (seen.has(key)) {
      const previous = rows.findIndex((row) => `${row.word.toLowerCase()}\0${row.partOfSpeech.toLowerCase()}` === key)
      if (previous >= 0) rows[previous] = { word, partOfSpeech, meaning, unit: rows[previous]?.unit ?? currentUnit }
      continue
    }
    seen.add(key)
    rows.push({ word, partOfSpeech, meaning, unit: currentUnit })
  }
  if (rows.length === 0) throw new VocabSheetError('Không có dòng hợp lệ. Cần đủ cột từ vựng, loại từ và nghĩa.')
  return { rows, skipped, title, topic, structured }
}

export async function vocabTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Tu vung')
  sheet.addRow(['Bộ đề', 'Demo'])
  sheet.addRow([null, 'Unit', 1])
  sheet.addRow([null, null, 'Từ vựng', 'Loại từ', 'Nghĩa'])
  sheet.addRow([null, null, 'substantial', 'adjective', 'đáng kể, lớn, quan trọng'])
  sheet.addRow([null, 'Unit', 2])
  sheet.addRow([null, null, 'Từ vựng', 'Loại từ', 'Nghĩa'])
  sheet.addRow([null, null, 'invoice', 'noun', 'hóa đơn'])
  for (const index of [1, 3, 6]) sheet.getRow(index).font = { bold: true }
  sheet.columns = [{ width: 14 }, { width: 12 }, { width: 24 }, { width: 18 }, { width: 42 }]
  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}

/** Three columns for a student's own notebook, which has no set or unit. */
export async function simpleVocabTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Tu vung')
  sheet.addRow(['Từ vựng', 'Loại từ', 'Nghĩa'])
  sheet.addRow(['substantial', 'adjective', 'đáng kể, lớn, quan trọng'])
  sheet.addRow(['invoice', 'noun', 'hóa đơn'])
  sheet.getRow(1).font = { bold: true }
  sheet.columns = [{ width: 24 }, { width: 18 }, { width: 42 }]
  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}
