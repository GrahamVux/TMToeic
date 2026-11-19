import type { INestApplication } from '@nestjs/common'
import sharp from 'sharp'
import { DB, type Db } from '../db/database.module'
import { assets, exams } from '../db/schema'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'
import { eq } from 'drizzle-orm'

function singlePagePdf(jpeg: Buffer): Buffer {
  const chunks: Buffer[] = []
  const offsets = [0]
  const length = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const push = (chunk: Buffer | string) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  const add = (chunk: Buffer | string) => {
    offsets.push(length())
    push(chunk)
  }
  push('%PDF-1.4\n')
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  add('2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n')
  add('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 40 80] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n')
  add(Buffer.concat([
    Buffer.from(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width 40 /Height 80 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    Buffer.from('\nendstream\nendobj\n'),
  ]))
  add('5 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n')
  const xrefAt = length()
  let xref = 'xref\n0 6\n0000000000 65535 f \n'
  for (let id = 1; id <= 5; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  push(xref)
  return Buffer.concat(chunks)
}

function pack(json: unknown, pdf: Buffer): Buffer {
  const encoded = Buffer.from(JSON.stringify(json))
  const header = Buffer.alloc(4)
  header.writeUInt32BE(encoded.length)
  return Buffer.concat([header, encoded, pdf])
}

describe('import a Listening PDF with Gemini crop boxes', () => {
  let app: INestApplication
  let admin: TestClient
  let db: Db
  const storage = {
    enabled: true,
    bucket: 'toeic-content',
    signedGetUrl: (key: string) => Promise.resolve(`https://r2.test/${key}`),
    deleteObject: () => Promise.resolve(),
    putObject: () => Promise.resolve(),
  }

  beforeAll(async () => {
    app = await createTestApp({}, { storage })
    db = app.get<Db>(DB)
    const signed = await login(app, ADMIN.username, ADMIN.password)
    await signed.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = signed.c
  })
  afterAll(() => app.close())

  it('cuts the photograph from the PDF and stores it on the question', async () => {
    const jpeg = await sharp({ create: { width: 40, height: 80, channels: 3, background: 'red' } }).jpeg().toBuffer()
    const code = `YBM-SCAN-${Date.now()}`
    const body = pack(
      {
        code,
        title: 'YBM Listening scan',
        durationSeconds: 2700,
        pages: [{ page: 1, rotationDegrees: 0 }],
        groups: [],
        questions: [
          {
            number: 1,
            partCode: 'PART_1',
            prompt: '',
            imageFile: 'q001.jpg',
            answer: 'A',
            options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' })),
          },
        ],
        crops: [{ file: 'q001.jpg', page: 1, kind: 'photo', questionNumbers: [1], box: [0, 0, 1000, 1000] }],
      },
      singlePagePdf(jpeg),
    )

    const created = await admin.agent.post('/api/v1/exams/import-listening-scan').set('x-toeic-client', 'web').set('content-type', 'application/octet-stream').send(body)
    expect(created.status).toBe(201)
    expect(created.body.code).toBe(code)
    expect(created.body.status).toBe('PUBLISHED')

    const content = await admin.get(`/exams/${created.body.id}/content`)
    const imageId = content.body.questions[0].imageAssetId as string
    expect(imageId).toEqual(expect.any(String))
    const [asset] = await db.select().from(assets).where(eq(assets.id, imageId))
    expect(asset?.mimeType).toBe('image/jpeg')
    expect(asset?.status).toBe('STORED')
  })

  it('shows the cut image for review and does not save the exam', async () => {
    const jpeg = await sharp({ create: { width: 40, height: 80, channels: 3, background: 'navy' } }).jpeg().toBuffer()
    const code = `YBM-PREVIEW-${Date.now()}`
    const body = pack(
      {
        code,
        title: 'Xem trước đề nghe',
        durationSeconds: 2700,
        pages: [{ page: 1, rotationDegrees: 0 }],
        groups: [],
        questions: [
          {
            number: 1,
            partCode: 'PART_1',
            prompt: '',
            imageFile: 'q001.jpg',
            answer: 'B',
            options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' })),
          },
        ],
        crops: [{ file: 'q001.jpg', page: 1, kind: 'photo', questionNumbers: [1], box: [0, 0, 1000, 1000] }],
      },
      singlePagePdf(jpeg),
    )

    const preview = await admin.agent.post('/api/v1/exams/import-listening-scan/preview').set('x-toeic-client', 'web').set('content-type', 'application/octet-stream').send(body)
    expect(preview.status).toBe(200)
    expect(preview.body.images['q001.jpg'].length).toBeGreaterThan(20)
    expect(preview.body.pages).toHaveLength(1)
    expect(preview.body.pages[0].length).toBeGreaterThan(20)
    const rows = await db.select().from(exams).where(eq(exams.code, code))
    expect(rows).toHaveLength(0)
  })
})
