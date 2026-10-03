import ExcelJS from 'exceljs'

export type VocabRow = { word: string; partOfSpeech: string; meaning: string }

const WORD_HEADERS = new Set(['tu vung', 'vocabulary', 'word', 'vocab', 'tu'])
const POS_HEADERS = new Set(['loai tu', 'tu loai', 'part of speech', 'pos', 'word class', 'loai'])
const MEANING_HEADERS = new Set(['nghia', 'meaning', 'definition', 'nghia tieng viet'])

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

/** Read the first worksheet. Header row is optional; otherwise columns are word, part of speech, meaning. */
export async function readVocabSheet(raw: Buffer): Promise<{ rows: VocabRow[]; skipped: number }> {
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

  const map = columnsOf(grid[0] ?? [])
  const body = map.header ? grid.slice(1) : grid
  const rows: VocabRow[] = []
  let skipped = 0
  const seen = new Set<string>()
  for (const line of body) {
    if (rows.length >= 2000) {
      skipped++
      continue
    }
    const word = (line[map.word] ?? '').trim()
    const partOfSpeech = (map.pos >= 0 ? line[map.pos] ?? '' : '').trim()
    const meaning = (line[map.meaning] ?? '').trim()
    if (!word && !partOfSpeech && !meaning) continue
    if (!word || !partOfSpeech || !meaning || word.length > 80 || partOfSpeech.length > 40 || meaning.length > 500) {
      skipped++
      continue
    }
    const key = `${word.toLowerCase()}\0${partOfSpeech.toLowerCase()}`
    if (seen.has(key)) {
      const previous = rows.findIndex((row) => `${row.word.toLowerCase()}\0${row.partOfSpeech.toLowerCase()}` === key)
      if (previous >= 0) rows[previous] = { word, partOfSpeech, meaning }
      continue
    }
    seen.add(key)
    rows.push({ word, partOfSpeech, meaning })
  }
  if (rows.length === 0) throw new VocabSheetError('Không có dòng hợp lệ. Cần đủ cột từ vựng, loại từ và nghĩa.')
  return { rows, skipped }
}

export async function vocabTemplate(): Promise<Buffer> {
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
