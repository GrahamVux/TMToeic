/** Classifies files of the "ETS 2018" zip into stable R2 object keys + roles. Pure (no I/O) so it is unit-tested. */

export const ASSET_ROLES = ['FULL_AUDIO', 'PART_AUDIO', 'QUESTION_PDF', 'TRANSCRIPT', 'ANSWER_KEY', 'BOOK', 'ARCHIVE', 'OTHER'] as const
export type AssetRole = (typeof ASSET_ROLES)[number]

export type Classified = {
  collection: string
  testNo: number | null
  role: AssetRole
  /** Object key prefix/name without collision suffix, ASCII only. */
  objectKey: string
  mimeType: string
}

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rar: 'application/vnd.rar',
}

const FOLDER: Record<AssetRole, string> = {
  FULL_AUDIO: 'audio',
  PART_AUDIO: 'audio',
  QUESTION_PDF: 'questions',
  TRANSCRIPT: 'transcripts',
  ANSWER_KEY: 'answers',
  BOOK: 'books',
  ARCHIVE: 'extras',
  OTHER: 'extras',
}

export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file'
  )
}

function splitExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.')
  return i <= 0 ? { base: name, ext: '' } : { base: name.slice(0, i), ext: name.slice(i + 1).toLowerCase() }
}

/** Plain-ASCII, lower-case, no diacritics; lets us match "Đáp án", "Dap an", "ĐÁP ÁN" alike. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

export function classifyEtsPath(zipPath: string, collection = 'ets-2018'): Classified | null {
  const segments = zipPath.split('/').filter(Boolean)
  const file = segments[segments.length - 1]
  if (!file || zipPath.endsWith('/')) return null
  const { base, ext } = splitExt(file)
  const mimeType = MIME[ext] ?? 'application/octet-stream'
  const dirs = segments.slice(0, -1).map(fold)
  const foldedBase = fold(base)
  const name = slugify(base)

  const make = (role: AssetRole, testNo: number | null, fileName: string): Classified => {
    const prefix = testNo !== null ? `${collection}/test-${String(testNo).padStart(2, '0')}` : collection
    return { collection, testNo, role, objectKey: `${prefix}/${FOLDER[role]}/${fileName}.${ext || 'bin'}`, mimeType }
  }

  // Full-length audio: "Audio File/05-Test5.mp3" → test 5
  const full = /^(\d{1,2})-test\s*(\d{1,2})$/.exec(foldedBase)
  if (ext === 'mp3' && full) return make('FULL_AUDIO', Number(full[2]), 'full')

  if (ext === 'rar') return make('ARCHIVE', null, name)

  // Whole books at the collection root (LC / RC 1000)
  if (segments.length <= 2 && ext === 'pdf') return make('BOOK', null, name)

  // "de 7", "de 1 chia nho", … → test number from the containing folder
  const testDir = dirs.map((d) => /^de\s*(\d{1,2})\b/.exec(d)).find(Boolean)
  const testNo = testDir ? Number(testDir[1]) : null

  if (ext === 'mp3') return make('PART_AUDIO', testNo, name)
  if (ext === 'xlsx' || ext === 'docx') return make('ANSWER_KEY', testNo, name)
  if (ext === 'pdf') {
    if (/transc/.test(foldedBase)) return make('TRANSCRIPT', testNo, name)
    if (/dap an|^key\b|\bkey\b/.test(foldedBase)) return make('ANSWER_KEY', testNo, name)
    return make('QUESTION_PDF', testNo, name)
  }
  return make('OTHER', testNo, name)
}
