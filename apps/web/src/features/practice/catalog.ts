export type ExamKind = 'full' | 'listening' | 'reading' | 'mixed'

const BRANDS = ['ETS', 'YBM', 'Hacker', 'Economy'] as const

export function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

export function examKind(parts: ReadonlyArray<{ skill: string }>): ExamKind {
  const skills = new Set(parts.map((part) => part.skill))
  if (skills.has('LISTENING') && skills.has('READING')) return 'full'
  if (skills.has('LISTENING')) return 'listening'
  if (skills.has('READING')) return 'reading'
  return 'mixed'
}

export function kindLabel(kind: ExamKind) {
  if (kind === 'full') return 'Đề tổng hợp'
  if (kind === 'listening') return 'Listening'
  if (kind === 'reading') return 'Reading'
  return 'Đề khác'
}

export function kindBadge(kind: ExamKind) {
  if (kind === 'full') return 'Full test'
  if (kind === 'listening') return 'Listening'
  if (kind === 'reading') return 'Reading'
  return 'Đề'
}

/** Series such as "ETS 2024" or "YBM 2026", taken from the code and title. */
export function examSeries(exam: { code: string; title: string }) {
  const text = `${exam.code} ${exam.title}`
  const year = text.match(/20\d{2}/)?.[0] ?? ''
  const upper = text.toUpperCase()
  const brand = BRANDS.find((name) => upper.includes(name.toUpperCase())) ?? 'Khác'
  const label = year ? `${brand} ${year}` : brand
  return { key: fold(label).replace(/\s+/g, '-'), label }
}

export function matchesName(exam: { code: string; title: string }, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(exam.title).includes(needle) || fold(exam.code).includes(needle)
}
