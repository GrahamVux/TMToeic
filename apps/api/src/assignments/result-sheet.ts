import ExcelJS from 'exceljs'
import { PRACTICE_LISTENING_SCALE, PRACTICE_READING_SCALE } from '../exams/scoring'

export type ReportQuestion = {
  id: string
  number: number
  partCode: string
  skill: 'LISTENING' | 'READING'
}

export type ReportStudent = {
  fullName: string
  listeningScore: number | null
  readingScore: number | null
  totalScore: number | null
  /** Selected option key per question id. Missing or null means the student left it blank. */
  answers: Record<string, string | null>
}

export type AssignmentReportInput = {
  examTitle: string
  questions: ReportQuestion[]
  correctKeys: Record<string, string>
  students: ReportStudent[]
}

const PART_ORDER = ['PART_1', 'PART_2', 'PART_3', 'PART_4', 'PART_5', 'PART_6', 'PART_7']

const NAVY = 'FF1B3A4B'
const GOLD = 'FFC4A35A'
const CREAM = 'FFF7F1E3'
const TEAL = 'FFE7F3F1'
const WHITE = 'FFFFFFFF'

function partLabel(code: string) {
  const n = code.replace('PART_', '')
  return `Part ${n}`
}

function spanLabel(prefix: string, list: PartBucket[]) {
  if (list.length === 0) return prefix
  const first = partLabel(list[0].code)
  const last = partLabel(list[list.length - 1].code)
  return list.length === 1 ? `${prefix} (${first})` : `${prefix} (${first} - ${last.replace('Part ', '')})`
}

function partSort(a: string, b: string) {
  const ia = PART_ORDER.indexOf(a)
  const ib = PART_ORDER.indexOf(b)
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
}

function skillLabel(skill: 'LISTENING' | 'READING') {
  return skill === 'LISTENING' ? 'Listening' : 'Reading'
}

function pct(correct: number, total: number) {
  if (total <= 0) return 0
  return Math.round((correct / total) * 1000) / 10
}

function rating(correct: number, total: number) {
  const ratio = total > 0 ? correct / total : 0
  if (ratio >= 0.8) return 'Tốt'
  if (ratio >= 0.6) return 'Khá'
  return 'Cần cải thiện'
}

function trapLabel(wrong: number, total: number) {
  const ratio = total > 0 ? wrong / total : 0
  if (ratio >= 0.8) return `Cực cao (${wrong} bạn sai)`
  if (ratio >= 0.65) return `Cao (${wrong} bạn sai)`
  return `Trung bình (${wrong} bạn sai)`
}

function sheetName(name: string, used: Set<string>) {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Hoc vien'
  let candidate = cleaned
  let n = 2
  while (used.has(candidate)) {
    const suffix = ` ${n}`
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`
    n += 1
  }
  used.add(candidate)
  return candidate
}

function paint(cell: ExcelJS.Cell, fill: string, bold = false, color = 'FF1A1A1A') {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
  cell.font = { bold, color: { argb: color }, name: 'Calibri', size: 11 }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD9D0C1' } },
    left: { style: 'thin', color: { argb: 'FFD9D0C1' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D0C1' } },
    right: { style: 'thin', color: { argb: 'FFD9D0C1' } },
  }
}

type PartBucket = { code: string; skill: 'LISTENING' | 'READING'; questions: ReportQuestion[] }

function buckets(questions: ReportQuestion[]): PartBucket[] {
  const map = new Map<string, PartBucket>()
  for (const q of questions) {
    const row = map.get(q.partCode) ?? { code: q.partCode, skill: q.skill, questions: [] }
    row.questions.push(q)
    map.set(q.partCode, row)
  }
  return [...map.values()].sort((a, b) => partSort(a.code, b.code))
}

function isRight(q: ReportQuestion, selected: string | null | undefined, correctKeys: Record<string, string>) {
  const key = selected?.trim().toUpperCase()
  const correct = correctKeys[q.id]?.trim().toUpperCase()
  return Boolean(key && correct && key === correct)
}

export async function buildAssignmentReport(input: AssignmentReportInput): Promise<Buffer> {
  const questions = [...input.questions].sort((a, b) => a.number - b.number || partSort(a.partCode, b.partCode))
  const parts = buckets(questions)
  const listeningParts = parts.filter((p) => p.skill === 'LISTENING')
  const readingParts = parts.filter((p) => p.skill === 'READING')
  const students = [...input.students].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1) || a.fullName.localeCompare(b.fullName, 'vi'))

  const book = new ExcelJS.Workbook()
  book.creator = 'Mr. Minh TOEIC'
  addClassSheet(book, input.examTitle, parts, listeningParts, readingParts, questions, students, input.correctKeys)
  addCommonWrongSheet(book, questions, students, input.correctKeys)
  const used = new Set(['Tổng Hợp Lớp', 'Câu Sai Chung (>2 Bạn)', 'Thang Điểm ETS'])
  for (const student of students) addStudentSheet(book, sheetName(student.fullName, used), student, parts, listeningParts, readingParts, questions, input.correctKeys)
  addScaleSheet(book)
  const raw = await book.xlsx.writeBuffer()
  return Buffer.from(raw)
}

function addClassSheet(
  book: ExcelJS.Workbook,
  examTitle: string,
  parts: PartBucket[],
  listeningParts: PartBucket[],
  readingParts: PartBucket[],
  questions: ReportQuestion[],
  students: ReportStudent[],
  correctKeys: Record<string, string>,
) {
  const ws = book.addWorksheet('Tổng Hợp Lớp')
  const listeningQs = listeningParts.flatMap((p) => p.questions)
  const readingQs = readingParts.flatMap((p) => p.questions)
  const headers = [
    'Học viên',
    ...listeningParts.map((p) => `${partLabel(p.code)} (${p.questions.length}c)`),
    ...(listeningParts.length ? [`Tổng LC (${listeningQs.length}c)`, 'Điểm LC (495)'] : []),
    ...readingParts.map((p) => `${partLabel(p.code)} (${p.questions.length}c)`),
    ...(readingParts.length ? [`Tổng RC (${readingQs.length}c)`, 'Điểm RC (495)'] : []),
    `Tổng Câu Đúng (${questions.length}c)`,
    'TỔNG ĐIỂM TOEIC (990)',
  ]
  ws.mergeCells(1, 1, 1, headers.length)
  ws.getCell(1, 1).value = `BẢNG TỔNG HỢP KẾT QUẢ VÀ ĐIỂM THI TOEIC (ĐỀ ${examTitle})`
  paint(ws.getCell(1, 1), NAVY, true, WHITE)
  ws.getRow(1).height = 28
  ws.mergeCells(2, 1, 2, headers.length)
  ws.getCell(2, 1).value = 'Quy đổi theo Thang điểm chuẩn ETS / Oxford (Thang điểm 10 - 990)'
  paint(ws.getCell(2, 1), CREAM, false, 'FF5C5346')
  headers.forEach((label, i) => {
    const cell = ws.getCell(4, i + 1)
    cell.value = label
    paint(cell, GOLD, true, NAVY)
  })
  ws.getRow(4).height = 32

  students.forEach((student, index) => {
    const row = ws.getRow(5 + index)
    const values: Array<string | number> = [student.fullName]
    const tally = (list: ReportQuestion[]) => list.filter((q) => isRight(q, student.answers[q.id], correctKeys)).length
    for (const part of listeningParts) values.push(`${tally(part.questions)}/${part.questions.length}`)
    if (listeningParts.length) {
      const correct = tally(listeningQs)
      values.push(`${correct}/${listeningQs.length} (${pct(correct, listeningQs.length).toFixed(1)}%)`)
      values.push(student.listeningScore ?? '—')
    }
    for (const part of readingParts) values.push(`${tally(part.questions)}/${part.questions.length}`)
    if (readingParts.length) {
      const correct = tally(readingQs)
      values.push(`${correct}/${readingQs.length} (${pct(correct, readingQs.length).toFixed(1)}%)`)
      values.push(student.readingScore ?? '—')
    }
    const correct = tally(questions)
    values.push(`${correct}/${questions.length} (${pct(correct, questions.length).toFixed(1)}%)`)
    values.push(student.totalScore ?? '—')
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1)
      cell.value = value
      paint(cell, index % 2 === 0 ? WHITE : TEAL, i === 0)
      if (i === 0) cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })
  })
  ws.columns = headers.map((label, i) => ({ width: i === 0 ? 28 : Math.max(16, label.length + 2) }))
  ws.views = [{ state: 'frozen', ySplit: 4 }]
}

function addCommonWrongSheet(book: ExcelJS.Workbook, questions: ReportQuestion[], students: ReportStudent[], correctKeys: Record<string, string>) {
  const ws = book.addWorksheet('Câu Sai Chung (>2 Bạn)')
  const headers = ['STT Câu', 'Kỹ Năng', 'Phần Thi (Part)', 'Số Lượng Sai', 'Tỉ Lệ Sai Cả Lớp', 'Mức Độ Bẫy', 'Danh Sách Học Viên Sai', 'Chi Tiết Đáp Án Từng Bạn']
  ws.mergeCells(1, 1, 1, headers.length)
  ws.getCell(1, 1).value = 'DANH SÁCH CÁC CÂU CÓ HƠN 2 BẠN LÀM SAI (TỪ 3 HỌC VIÊN TRỞ LÊN)'
  paint(ws.getCell(1, 1), NAVY, true, WHITE)
  ws.getRow(1).height = 24
  ws.mergeCells(2, 1, 2, headers.length)
  ws.getCell(2, 1).value = 'Sắp theo số câu. Bỏ trống tính là sai. (S) là sai, (Đ) là đúng — cột chi tiết gồm cả lớp.'
  paint(ws.getCell(2, 1), CREAM, false, 'FF5C5346')
  headers.forEach((label, i) => {
    const cell = ws.getCell(4, i + 1)
    cell.value = label
    paint(cell, GOLD, true, NAVY)
  })

  const rows = questions
    .map((q) => {
      const wrongStudents = students.filter((s) => !isRight(q, s.answers[q.id], correctKeys))
      return { q, wrongStudents }
    })
    .filter((row) => row.wrongStudents.length > 2)
    .sort((a, b) => a.q.number - b.q.number)

  rows.forEach((row, index) => {
    const names = row.wrongStudents.map((s) => s.fullName).join(', ')
    const detail = students
      .map((s) => {
        const picked = s.answers[row.q.id]?.trim().toUpperCase() || '—'
        const mark = isRight(row.q, s.answers[row.q.id], correctKeys) ? 'Đ' : 'S'
        return `${s.fullName}: ${picked}(${mark})`
      })
      .join(' | ')
    const values = [
      row.q.number,
      skillLabel(row.q.skill),
      partLabel(row.q.partCode),
      row.wrongStudents.length,
      `${pct(row.wrongStudents.length, students.length).toFixed(1)}%`,
      trapLabel(row.wrongStudents.length, students.length),
      names,
      detail,
    ]
    values.forEach((value, i) => {
      const cell = ws.getCell(5 + index, i + 1)
      cell.value = value
      paint(cell, WHITE, i === 0)
      if (i >= 6) cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    })
  })
  ws.columns = [{ width: 12 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 24 }, { width: 36 }, { width: 64 }]
}

function addStudentSheet(
  book: ExcelJS.Workbook,
  name: string,
  student: ReportStudent,
  parts: PartBucket[],
  listeningParts: PartBucket[],
  readingParts: PartBucket[],
  questions: ReportQuestion[],
  correctKeys: Record<string, string>,
) {
  const ws = book.addWorksheet(name)
  const headers = ['Phần thi (Part)', 'Số câu đúng', 'Số câu sai', 'Tổng số câu', 'Tỉ lệ đúng (%)', 'Điểm Quy Đổi / Đánh giá', 'Danh sách các câu sai']
  ws.mergeCells(1, 1, 1, headers.length)
  ws.getCell(1, 1).value = `BẢNG PHÂN TÍCH KẾT QUẢ CHI TIẾT - ${student.fullName}`
  paint(ws.getCell(1, 1), NAVY, true, WHITE)
  ws.getRow(1).height = 24
  ws.mergeCells(3, 1, 3, headers.length)
  ws.getCell(3, 1).value = 'I. BẢNG TỔNG HỢP THEO PART & ĐIỂM THI'
  paint(ws.getCell(3, 1), TEAL, true, NAVY)
  headers.forEach((label, i) => {
    const cell = ws.getCell(4, i + 1)
    cell.value = label
    paint(cell, GOLD, true, NAVY)
  })

  const tally = (list: ReportQuestion[]) => list.filter((q) => isRight(q, student.answers[q.id], correctKeys)).length
  const wrongNumbers = (list: ReportQuestion[]) =>
    list
      .filter((q) => !isRight(q, student.answers[q.id], correctKeys))
      .map((q) => q.number)
      .sort((a, b) => a - b)
      .join(', ')

  let rowIndex = 5
  const writeSummary = (label: string, list: ReportQuestion[], scoreText: string, emphasize = false) => {
    const correct = tally(list)
    const wrong = list.length - correct
    const values = [label, correct, wrong, list.length, pct(correct, list.length), scoreText, wrongNumbers(list)]
    values.forEach((value, i) => {
      const cell = ws.getCell(rowIndex, i + 1)
      cell.value = value
      paint(cell, emphasize ? CREAM : WHITE, emphasize || i === 0)
      if (i === 0 || i === 6) cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    })
    rowIndex += 1
  }

  for (const part of parts) {
    const nums = part.questions.map((q) => q.number)
    const start = Math.min(...nums)
    const end = Math.max(...nums)
    writeSummary(`${partLabel(part.code)} (${start}-${end})`, part.questions, rating(tally(part.questions), part.questions.length))
  }
  const listeningQs = listeningParts.flatMap((p) => p.questions)
  const readingQs = readingParts.flatMap((p) => p.questions)
  if (listeningQs.length) {
    const score = student.listeningScore !== null ? `${student.listeningScore} / 495 điểm` : '—'
    writeSummary(spanLabel('TỔNG LISTENING', listeningParts), listeningQs, score, true)
  }
  if (readingQs.length) {
    const score = student.readingScore !== null ? `${student.readingScore} / 495 điểm` : '—'
    writeSummary(spanLabel('TỔNG READING', readingParts), readingQs, score, true)
  }
  const totalScore = student.totalScore !== null ? `${student.totalScore} / 990 ĐIỂM` : '—'
  writeSummary(spanLabel('TỔNG TOÀN BÀI', parts), questions, totalScore, true)

  rowIndex += 1
  const sectionRow = rowIndex
  ws.mergeCells(sectionRow, 1, sectionRow, 15)
  const lastNumber = questions.length ? questions[questions.length - 1].number : questions.length
  ws.getCell(sectionRow, 1).value = `II. BẢNG CHI TIẾT TỪNG CÂU HỎI (1 - ${Math.max(lastNumber, questions.length)})`
  paint(ws.getCell(sectionRow, 1), TEAL, true, NAVY)
  const headerRow = sectionRow + 1
  const maxNumber = Math.max(50, ...questions.map((q) => q.number))
  const blocks = Math.ceil(maxNumber / 50)
  for (let block = 0; block < blocks; block++) {
    const col = block * 4 + 1
    ;['Câu', 'Đáp án', 'Trạng thái'].forEach((label, i) => {
      const cell = ws.getCell(headerRow, col + i)
      cell.value = label
      paint(cell, GOLD, true, NAVY)
    })
  }
  const byNumber = new Map(questions.map((q) => [q.number, q]))
  for (let n = 1; n <= blocks * 50; n++) {
    const q = byNumber.get(n)
    if (!q) continue
    const block = Math.floor((n - 1) / 50)
    const offset = (n - 1) % 50
    const col = block * 4 + 1
    const line = headerRow + 1 + offset
    const picked = student.answers[q.id]?.trim().toUpperCase() || '—'
    const right = isRight(q, student.answers[q.id], correctKeys)
    const values = [n, picked, right ? 'Đúng' : 'Sai']
    values.forEach((value, i) => {
      const cell = ws.getCell(line, col + i)
      cell.value = value
      paint(cell, right ? TEAL : 'FFF8DCD8', false, right ? 'FF1B3A4B' : 'FF9B3A32')
    })
  }
  ws.columns = headers.map((_, i) => ({ width: i === 0 ? 32 : i === 6 ? 28 : 18 }))
}

function addScaleSheet(book: ExcelJS.Workbook) {
  const ws = book.addWorksheet('Thang Điểm ETS')
  ws.mergeCells(1, 1, 1, 7)
  ws.getCell(1, 1).value = 'BẢNG QUY ĐỔI ĐIỂM TOEIC THỰC HÀNH (PRACTICE TEST ESTIMATED CONVERSION TABLE)'
  paint(ws.getCell(1, 1), NAVY, true, WHITE)
  const headers = ['Số câu đúng', 'Điểm Listening', 'Điểm Reading']
  for (const start of [1, 5]) {
    headers.forEach((label, i) => {
      const cell = ws.getCell(3, start + i)
      cell.value = label
      paint(cell, GOLD, true, NAVY)
    })
  }
  for (let raw = 0; raw <= 100; raw++) {
    const left = raw <= 50
    const col = left ? 1 : 5
    const line = left ? 4 + raw : 4 + (raw - 51)
    const values = [raw, PRACTICE_LISTENING_SCALE[raw], PRACTICE_READING_SCALE[raw]]
    values.forEach((value, i) => {
      const cell = ws.getCell(line, col + i)
      cell.value = value
      paint(cell, WHITE)
    })
  }
  ws.columns = [{ width: 16 }, { width: 18 }, { width: 16 }, { width: 4 }, { width: 16 }, { width: 18 }, { width: 16 }]
}
