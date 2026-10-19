import ExcelJS from 'exceljs'

export type StudentSheetRow = { fullName: string; phone: string }

export class StudentSheetError extends Error {}

const NAME_HEADERS = new Set(['ho ten', 'ho va ten', 'ten', 'name', 'full name', 'hoc vien'])
const PHONE_HEADERS = new Set(['sdt', 'so dien thoai', 'dien thoai', 'phone', 'so dt', 'mobile'])

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
  if (typeof value === 'number') {
    const digits = String(Math.trunc(value))
    return digits.length === 9 ? `0${digits}` : digits
  }
  if (typeof value === 'string' || typeof value === 'boolean') return String(value).trim()
  if (value instanceof Date) return ''
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? '').join('').trim()
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text.trim()
  if (typeof value === 'object' && 'result' in value) return cellText(value.result as ExcelJS.CellValue)
  return ''
}

function normalizePhone(raw: string) {
  const compact = raw.replace(/[\s.\-]/g, '')
  const digits = compact.replace(/[^\d]/g, '')
  if (digits.length === 9) return `0${digits}`
  return digits
}

export async function studentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Hoc vien')
  sheet.addRow(['Họ tên', 'Số điện thoại'])
  sheet.getColumn(1).width = 28
  sheet.getColumn(2).width = 18
  const raw = await workbook.xlsx.writeBuffer()
  return Buffer.from(raw)
}

/** First sheet. Header row optional; otherwise column A is the name and column B is the phone. */
export async function readStudentSheet(raw: Buffer): Promise<StudentSheetRow[]> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(raw as unknown as ExcelJS.Buffer)
  } catch {
    throw new StudentSheetError('Không đọc được file Excel. Hãy dùng định dạng .xlsx.')
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new StudentSheetError('File Excel không có trang tính nào.')

  const grid: string[][] = []
  sheet.eachRow((row) => {
    const width = Math.max(row.cellCount, 2)
    grid.push(Array.from({ length: width }, (_, index) => cellText(row.getCell(index + 1).value)))
  })
  if (grid.length === 0) throw new StudentSheetError('File không có dòng học viên nào.')

  const header = (grid[0] ?? []).map(fold)
  const nameAt = header.findIndex((cell) => NAME_HEADERS.has(cell))
  const phoneAt = header.findIndex((cell) => PHONE_HEADERS.has(cell))
  const hasHeader = nameAt >= 0 && phoneAt >= 0
  const nameCol = hasHeader ? nameAt : 0
  const phoneCol = hasHeader ? phoneAt : 1
  const body = hasHeader ? grid.slice(1) : grid

  const rows: StudentSheetRow[] = []
  for (const line of body) {
    if (rows.length >= 500) throw new StudentSheetError('Mỗi file tối đa 500 học viên.')
    const fullName = (line[nameCol] ?? '').trim()
    const phone = normalizePhone(line[phoneCol] ?? '')
    if (!fullName && !phone) continue
    if (fullName.length < 2 || fullName.length > 120) throw new StudentSheetError(`Họ tên không hợp lệ: "${fullName || '(trống)'}"`)
    if (!/^\d{8,15}$/.test(phone)) throw new StudentSheetError(`Số điện thoại không hợp lệ của ${fullName}: "${line[phoneCol] ?? ''}"`)
    rows.push({ fullName, phone })
  }
  if (rows.length === 0) throw new StudentSheetError('File không có dòng học viên nào.')
  return rows
}

export async function studentResultSheet(
  rows: Array<{ fullName: string; phone: string; studentCode: string; username: string; password: string; note: string }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Tai khoan')
  sheet.addRow(['Họ tên', 'Số điện thoại', 'Mã học viên', 'Tên đăng nhập', 'Mật khẩu', 'Ghi chú'])
  for (const row of rows) sheet.addRow([row.fullName, row.phone, row.studentCode, row.username, row.password, row.note])
  sheet.columns.forEach((column) => {
    column.width = 22
  })
  const raw = await workbook.xlsx.writeBuffer()
  return Buffer.from(raw)
}
