import ExcelJS from 'exceljs'

export type VocabRow = { word: string; partOfSpeech: string; meaning: string; example: string; unit: number | null; topic?: string | null }

const WORD_HEADERS = new Set(['tu vung', 'vocabulary', 'word', 'vocab', 'tu'])
const POS_HEADERS = new Set(['loai tu', 'tu loai', 'part of speech', 'pos', 'word class', 'loai'])
const MEANING_HEADERS = new Set(['nghia', 'nghia tieng viet', 'meaning', 'definition'])
const EXAMPLE_HEADERS = new Set(['cau mau', 'cau vi du', 'vi du', 'example', 'sample', 'sentence', 'sample sentence', 'example sentence', 'cau mau toeic'])
const UNIT_COL_HEADERS = new Set(['unit', 'tap', 'bai', 'lesson'])
const TOPIC_COL_HEADERS = new Set(['chu de', 'topic', 'chuyen de'])
const SET_LABELS = new Set(['bo de', 'bo tu', 'bo tu vung', 'ten bo', 'ten bo tu', 'ten bo de'])
const TOPIC_LABELS = new Set(['chu de', 'topic', 'chuyen de'])
const UNIT_LABELS = new Set(['unit', 'tap'])
const GUIDE_LABELS = new Set(['huong dan', 'ghi chu', 'note'])

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

type ColumnMap = { word: number; pos: number; meaning: number; example: number; unit: number; topic: number; header: boolean }

function columnsOf(header: string[]): ColumnMap {
  const folded = header.map(fold)
  const word = folded.findIndex((cell) => WORD_HEADERS.has(cell))
  const meaning = folded.findIndex((cell) => MEANING_HEADERS.has(cell))
  const pos = folded.findIndex((cell) => POS_HEADERS.has(cell))
  const example = folded.findIndex((cell) => EXAMPLE_HEADERS.has(cell))
  const unit = folded.findIndex((cell) => UNIT_COL_HEADERS.has(cell))
  const topic = folded.findIndex((cell) => TOPIC_COL_HEADERS.has(cell))
  if (word >= 0 && meaning >= 0) {
    return { word, pos, meaning, example, unit, topic, header: true }
  }
  return { word: 0, pos: 1, meaning: 2, example: 3, unit: -1, topic: -1, header: false }
}

function parseUnitValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/^unit\s*/i, '').replace(/^t[aâậ]p\s*/i, '')
  if (!/^\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value >= 1 && value <= 500 ? value : null
}

function unitNumber(line: string[]) {
  const at = line.findIndex((cell) => UNIT_LABELS.has(fold(cell)))
  if (at < 0) return null
  for (const cell of line.slice(at + 1)) {
    const parsed = parseUnitValue(cell)
    if (parsed != null) return parsed
  }
  return null
}

function labelValue(line: string[], labels: Set<string>) {
  const cells = line.map((cell, index) => ({ cell, index })).filter((item) => item.cell)
  if (cells.length < 2 || !labels.has(fold(cells[0]?.cell ?? ''))) return null
  return cells[1]?.cell ?? null
}

export type VocabSheet = { rows: VocabRow[]; skipped: number; title: string | null; topic: string | null; structured: boolean }

/**
 * Parses uploaded .xlsx vocabulary workbooks:
 * 1. Modern clean table (Chủ đề / Bộ đề rows + header Unit | Từ vựng | Loại từ | Nghĩa | Câu mẫu)
 * 2. Indented section format (Bộ đề / Unit N / Từ vựng, Loại từ, Nghĩa, [Câu mẫu])
 * 3. Legacy 3-column sheet (Từ vựng | Loại từ | Nghĩa)
 */
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
    const width = Math.max(row.cellCount, 6)
    grid.push(Array.from({ length: width }, (_, index) => cellText(row.getCell(index + 1).value)))
  })
  if (grid.length === 0) throw new VocabSheetError('File không có dòng từ vựng nào.')

  const hasSectionUnit = grid.some((line) => unitNumber(line) != null)
  const hasHeaderUnit = grid.some((line) => {
    const m = columnsOf(line)
    return m.header && m.unit >= 0
  })
  const hasMetadata = grid.some((line) => Boolean(labelValue(line, SET_LABELS) || labelValue(line, TOPIC_LABELS)))
  const structured = hasSectionUnit || hasHeaderUnit || hasMetadata

  const rows: VocabRow[] = []
  let skipped = 0
  let title: string | null = null
  let topic: string | null = null
  let currentUnit: number | null = structured ? 1 : null
  let columns: ColumnMap | null = null
  const seen = new Set<string>()

  for (const line of grid) {
    const firstNonEmpty = line.find((c) => Boolean(c)) ?? ''
    if (GUIDE_LABELS.has(fold(firstNonEmpty))) continue

    const setName = labelValue(line, SET_LABELS)
    if (setName) {
      title ??= setName.slice(0, 120)
      continue
    }
    const topicName = labelValue(line, TOPIC_LABELS)
    if (topicName && !columnsOf(line).header) {
      topic ??= topicName.slice(0, 80)
      continue
    }
    const header = columnsOf(line)
    if (header.header) {
      columns = header
      continue
    }
    const marked = unitNumber(line)
    if (marked != null) {
      currentUnit = marked
      continue
    }
    if (structured && !columns) continue

    const used = columns ?? { word: 0, pos: 1, meaning: 2, example: 3, unit: -1, topic: -1, header: false }
    if (rows.length >= 2000) {
      skipped++
      continue
    }
    const word = (line[used.word] ?? '').trim()
    const partOfSpeech = (used.pos >= 0 ? line[used.pos] ?? '' : '').trim()
    const meaning = (line[used.meaning] ?? '').trim()
    const fallbackExampleCol = used.example >= 0 ? used.example : used.meaning + 1
    const exampleConflict = fallbackExampleCol === used.word || fallbackExampleCol === used.pos || fallbackExampleCol === used.unit || fallbackExampleCol === used.topic
    const example = (exampleConflict ? '' : (line[fallbackExampleCol] ?? '').trim()).slice(0, 600)
    const rowUnit = used.unit >= 0 ? parseUnitValue(line[used.unit] ?? '') ?? currentUnit : currentUnit
    const rowTopic = used.topic >= 0 ? (line[used.topic] ?? '').trim().slice(0, 80) || null : null

    if (!word && !partOfSpeech && !meaning) continue
    if (!word || !partOfSpeech || !meaning || word.length > 80 || partOfSpeech.length > 40 || meaning.length > 500) {
      skipped++
      continue
    }

    const key = `${word.toLowerCase()}\0${partOfSpeech.toLowerCase()}`
    if (seen.has(key)) {
      const previous = rows.findIndex((row) => `${row.word.toLowerCase()}\0${row.partOfSpeech.toLowerCase()}` === key)
      if (previous >= 0) {
        rows[previous] = {
          word,
          partOfSpeech,
          meaning,
          example: example || rows[previous]?.example || '',
          unit: rowUnit ?? rows[previous]?.unit ?? currentUnit,
          topic: rowTopic ?? rows[previous]?.topic ?? null,
        }
      }
      continue
    }
    seen.add(key)
    rows.push({ word, partOfSpeech, meaning, example, unit: rowUnit, topic: rowTopic })
  }

  if (rows.length === 0) throw new VocabSheetError('Không có dòng hợp lệ. Cần đủ cột từ vựng, loại từ và nghĩa.')
  return { rows, skipped, title, topic, structured }
}

const SAMPLE_TOEIC_WORDS: ReadonlyArray<[number, string, string, string, string]> = [
  [1, 'substantial', 'adjective', 'đáng kể, lớn, quan trọng', 'The company saw a substantial rise in revenue this year. (Công ty đã chứng kiến mức tăng doanh thu đáng kể trong năm nay.)'],
  [1, 'agreement', 'noun', 'hợp đồng, thỏa thuận', 'Both parties signed the agreement after two hours of negotiation. (Cả hai bên đã ký thỏa thuận sau hai giờ thương lượng.)'],
  [1, 'negotiate', 'verb', 'đàm phán, thương lượng', 'Our team will negotiate the delivery terms tomorrow morning. (Nhóm chúng tôi sẽ đàm phán điều khoản giao hàng vào sáng mai.)'],
  [1, 'implement', 'verb', 'triển khai, thực hiện', 'We plan to implement the new attendance policy next month. (Chúng tôi dự định triển khai chính sách điểm danh mới vào tháng tới.)'],
  [1, 'comply', 'verb', 'tuân thủ, chấp hành', 'All suppliers must comply with international safety standards. (Mọi nhà cung cấp phải tuân thủ tiêu chuẩn an toàn quốc tế.)'],
  [1, 'authorize', 'verb', 'ủy quyền, cho phép', 'Only the finance director can authorize this expenditure. (Chỉ giám đốc tài chính mới có thể phê duyệt khoản chi này.)'],
  [1, 'mandatory', 'adjective', 'bắt buộc', 'Safety training is mandatory for all new warehouse staff. (Đào tạo an toàn là bắt buộc đối với toàn bộ nhân viên kho mới.)'],
  [1, 'delegate', 'verb', 'giao phó, ủy thác', 'Good managers know how to delegate tasks effectively. (Nhà quản lý giỏi biết cách phân công công việc hiệu quả.)'],

  [2, 'invoice', 'noun', 'hóa đơn', 'Please attach the original invoice to your reimbursement claim. (Vui lòng đính kèm hóa đơn gốc vào phiếu đề nghị hoàn chi.)'],
  [2, 'reimburse', 'verb', 'hoàn trả, bồi hoàn chi phí', 'The firm will reimburse employees for approved travel expenses. (Công ty sẽ hoàn trả cho nhân viên các chi phí công tác đã duyệt.)'],
  [2, 'expenditure', 'noun', 'khoản chi tiêu, chi phí', 'Marketing expenditure increased slightly in the third quarter. (Chi phí tiếp thị đã tăng nhẹ trong quý ba.)'],
  [2, 'forecast', 'noun', 'dự báo, dự toán', 'According to the sales forecast, demand will peak in December. (Theo dự báo doanh số, nhu cầu sẽ đạt đỉnh vào tháng Mười Hai.)'],
  [2, 'deficit', 'noun', 'thâm hụt, thiếu hụt ngân sách', 'Cost-cutting measures helped reduce the annual budget deficit. (Các biện pháp cắt giảm chi phí đã giúp giảm thâm hụt ngân sách năm.)'],
  [2, 'transaction', 'noun', 'giao dịch', 'Every online transaction is encrypted for customer protection. (Mọi giao dịch trực tuyến đều được mã hóa để bảo vệ khách hàng.)'],
  [2, 'installment', 'noun', 'kỳ trả góp, đợt thanh toán', 'Clients can pay the full balance in three monthly installments. (Khách hàng có thể thanh toán toàn bộ số dư trong ba kỳ hằng tháng.)'],
  [2, 'lucrative', 'adjective', 'sinh lời cao, béo bở', 'They secured a lucrative distribution contract in Southeast Asia. (Họ đã giành được hợp đồng phân phối sinh lời cao tại Đông Nam Á.)'],

  [3, 'recruit', 'verb', 'tuyển dụng', 'The HR department aims to recruit ten software engineers this fall. (Phòng nhân sự đặt mục tiêu tuyển dụng mười kỹ sư phần mềm mùa thu này.)'],
  [3, 'eligible', 'adjective', 'đủ điều kiện, thích hợp', 'Full-time employees are eligible for the annual health checkup. (Nhân viên toàn thời gian đủ điều kiện khám sức khỏe định kỳ hằng năm.)'],
  [3, 'shipment', 'noun', 'lô hàng, việc giao hàng', 'The morning shipment arrived ahead of schedule at Pier 4. (Lô hàng buổi sáng đã cập bến số 4 sớm hơn dự kiến.)'],
  [3, 'merchandise', 'noun', 'hàng hóa', 'Damaged merchandise must be reported within 48 hours of delivery. (Hàng hóa bị hư hỏng phải được báo cáo trong vòng 48 giờ sau khi giao.)'],
  [3, 'inventory', 'noun', 'hàng tồn kho, bảng kiểm kê', 'Warehouse staff conduct a full inventory check every Friday. (Nhân viên kho tiến hành kiểm kê toàn bộ hàng tồn mỗi thứ Sáu.)'],
  [3, 'accommodate', 'verb', 'đáp ứng, chứa được', 'The conference hall can accommodate up to 300 participants. (Hội trường có thể chứa tối đa 300 người tham dự.)'],
  [3, 'postpone', 'verb', 'trì hoãn, dời lại', 'Because of the storm, we had to postpone the site inspection. (Vì cơn bão, chúng tôi phải hoãn chuyến kiểm tra hiện trường.)'],
  [3, 'adjacent', 'adjective', 'liền kề, ngay cạnh', 'Visitor parking is available in the garage adjacent to Lobby B. (Bãi đỗ xe khách nằm trong nhà xe liền kề Sảnh B.)'],
]

export async function vocabTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Từ vựng TOEIC', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  const metaRows: Array<[string, string]> = [
    ['Chủ đề', 'TOEIC Công sở & Kinh doanh'],
    ['Bộ đề', '600 Từ vựng TOEIC Thiết yếu (Kèm Câu mẫu)'],
    ['Hướng dẫn', 'Nhập mỗi từ 1 dòng theo cột Unit (1, 2, 3...). Tải lên web để kiểm tra & sửa từng Unit trước khi đẩy vào DB.'],
  ]
  for (const [idx, [k, v]] of metaRows.entries()) {
    const row = sheet.addRow([k, v])
    row.height = 22
    row.getCell(1).font = { bold: true, color: { argb: 'FF1E333C' }, size: 11 }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F2F5' } }
    row.getCell(2).font = { bold: idx < 2, italic: idx === 2, color: { argb: idx === 2 ? 'FF57535F' : 'FF1F7A8C' }, size: 11 }
    sheet.mergeCells(idx + 1, 2, idx + 1, 5)
  }

  const headerRow = sheet.addRow(['Unit', 'Từ vựng', 'Loại từ', 'Nghĩa tiếng Việt', 'Câu mẫu TOEIC'])
  headerRow.height = 26
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A8C' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

  for (const [i, item] of SAMPLE_TOEIC_WORDS.entries()) {
    const r = sheet.addRow([...item])
    r.height = 28
    const bg = i % 2 === 1 ? 'FFF7FBFD' : 'FFFFFFFF'
    r.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2ECEF' } },
        right: { style: 'thin', color: { argb: 'FFE2ECEF' } },
      }
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left', wrapText: true }
      if (colNumber === 2) cell.font = { bold: true, color: { argb: 'FF1E333C' } }
      if (colNumber === 3) cell.font = { italic: true, color: { argb: 'FF2B8A9C' } }
    })
  }

  sheet.columns = [
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 34 },
    { width: 72 },
  ]
  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}

/** Personal notebook Excel template supporting Topic, Unit, Word, POS, Meaning, Example. */
export async function simpleVocabTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sổ tay cá nhân', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const header = sheet.addRow(['Chủ đề', 'Unit', 'Từ vựng', 'Loại từ', 'Nghĩa tiếng Việt', 'Câu mẫu'])
  header.height = 25
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A8C' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  const rows: Array<[string, number, string, string, string, string]> = [
    ['Công sở', 1, 'substantial', 'adjective', 'đáng kể, lớn, quan trọng', 'The company saw a substantial rise in revenue this year.'],
    ['Tài chính', 2, 'invoice', 'noun', 'hóa đơn', 'Please send the updated invoice before Friday.'],
    ['Công sở', 1, 'deadline', 'noun', 'hạn chót', 'We must meet the submission deadline on Tuesday.'],
    ['Nhân sự', 3, 'eligible', 'adjective', 'đủ điều kiện', 'All permanent employees are eligible for annual leave.'],
    ['Vận hành', 3, 'shipment', 'noun', 'lô hàng', 'The morning shipment arrived ahead of schedule.'],
    ['Cụm từ', 1, 'meet the deadline', 'phrase', 'kịp hạn chót', 'Extra staff were hired to meet the deadline.'],
  ]
  for (const row of rows) {
    const r = sheet.addRow(row)
    r.height = 24
    r.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  }
  sheet.columns = [{ width: 18 }, { width: 10 }, { width: 22 }, { width: 16 }, { width: 32 }, { width: 54 }]
  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}
