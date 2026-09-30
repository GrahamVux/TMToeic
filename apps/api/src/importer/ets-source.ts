import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyEtsPath, type AssetRole } from '../assets/ets-layout'
import { entryBuffer, openZip, readAllEntries, unzipBuffer } from '../scripts/zip-util'

export type SourceFile = { name: string; role: AssetRole; data: Buffer; ext: string }

export type TestSource = {
  testNo: number
  questionPdfs: SourceFile[]
  transcripts: SourceFile[]
  /** Answer key as images (a .docx of screenshots is unpacked) or spreadsheets. */
  answerImages: Array<{ name: string; mimeType: string; data: Buffer }>
  answerSheets: SourceFile[]
}

const IMAGE_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
const extOf = (n: string) => n.slice(n.lastIndexOf('.') + 1).toLowerCase()

/** Reads the question PDFs, transcripts and answer key of one test straight out of the zip (also cached in the OS temp dir). */
export async function loadTestSource(zipPath: string, testNo: number, collection = 'ets-2018'): Promise<TestSource> {
  const zip = await openZip(zipPath)
  const entries = await readAllEntries(zip)
  const source: TestSource = { testNo, questionPdfs: [], transcripts: [], answerImages: [], answerSheets: [] }
  const cacheDir = join(tmpdir(), 'toeic-import-cache', collection, `test-${String(testNo).padStart(2, '0')}`)
  mkdirSync(cacheDir, { recursive: true })

  for (const entry of entries) {
    const c = classifyEtsPath(entry.fileName, collection)
    if (!c || c.testNo !== testNo) continue
    if (!['QUESTION_PDF', 'TRANSCRIPT', 'ANSWER_KEY'].includes(c.role)) continue
    const name = entry.fileName.split('/').pop() ?? entry.fileName
    const data = await entryBuffer(zip, entry)
    const file: SourceFile = { name, role: c.role, data, ext: extOf(name) }
    writeFileSync(join(cacheDir, c.objectKey.split('/').pop()!), data)

    if (c.role === 'QUESTION_PDF') source.questionPdfs.push(file)
    else if (c.role === 'TRANSCRIPT') source.transcripts.push(file)
    else if (file.ext === 'docx') {
      for (const f of await unzipBuffer(data)) {
        const e = extOf(f.name)
        if (f.name.startsWith('word/media/') && IMAGE_MIME[e]) source.answerImages.push({ name: `${name}:${f.name}`, mimeType: IMAGE_MIME[e], data: f.data })
      }
    } else if (file.ext === 'pdf') source.answerImages.push({ name, mimeType: 'application/pdf', data })
    else source.answerSheets.push(file)
  }
  zip.close()
  return source
}
