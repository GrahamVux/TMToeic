import type { INestApplication } from '@nestjs/common'
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@toeic/shared'
import ExcelJS from 'exceljs'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'

async function workbook(rows: string[][]) {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('Tu vung')
  for (const row of rows) sheet.addRow(row)
  return Buffer.from(await book.xlsx.writeBuffer())
}

describe('Study notebook and flashcards (e2e)', () => {
  let app: INestApplication
  let admin: TestClient
  let student: TestClient

  beforeAll(async () => {
    app = await createTestApp()
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
    const created = await admin.post('/users/students').send({ fullName: 'Học từ vựng' })
    const signed = await login(app, created.body.user.studentCode as string, created.body.temporaryPassword as string)
    await signed.c.post('/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'StudentPass99' })
    student = signed.c
  })

  afterAll(() => app.close())

  function importFile(who: TestClient, body: Buffer) {
    return who.agent
      .post('/api/v1/study/vocab/import')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(body)
  }

  it('lets an admin import a vocabulary workbook and a student save words into a notebook', async () => {
    const file = await workbook([
      ['Từ vựng', 'Loại từ', 'Nghĩa'],
      ['invoice', 'noun', 'hóa đơn'],
      ['invoice', 'verb', 'lập hóa đơn'],
      ['', 'noun', 'thiếu từ'],
    ])
    expect((await importFile(student, file)).status).toBe(403)
    const imported = await importFile(admin, file)
    expect(imported.status).toBe(200)
    expect(imported.body).toMatchObject({ imported: 2, skipped: 1 })

    const again = await importFile(admin, file)
    expect(again.body.updated).toBe(2)

    const listed = await student.get('/study/vocab?q=invoice')
    expect(listed.body.total).toBeGreaterThanOrEqual(2)
    expect(listed.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: 'invoice', partOfSpeech: 'noun', meaning: 'hóa đơn' }),
        expect.objectContaining({ word: 'invoice', partOfSpeech: 'verb', meaning: 'lập hóa đơn' }),
      ]),
    )

    const saved = await student.post('/study/notebook').send({ word: 'invoice' })
    expect(saved.status).toBe(200)
    expect(saved.body.alreadySaved).toBe(false)
    expect(saved.body.entries).toHaveLength(2)

    const duplicate = await student.post('/study/notebook').send({ word: 'invoice,' })
    expect(duplicate.body.alreadySaved).toBe(true)

    const unknown = await student.post('/study/notebook').send({ word: 'quixotic' })
    expect(unknown.body.entries[0]).toMatchObject({ word: 'quixotic', partOfSpeech: null, meaning: null, source: 'EXAM' })

    const phrase = await student.post('/study/notebook').send({ word: 'two words' })
    expect(phrase.status).toBe(400)

    const notebook = await student.get('/study/notebook')
    expect(notebook.body.total).toBe(3)
    expect(notebook.body.missingMeaning).toBe(1)

    const blank = notebook.body.items.find((item: { word: string }) => item.word === 'quixotic')
    const filled = await student.patch(`/study/notebook/${blank.id}`).send({ partOfSpeech: 'adjective', meaning: 'viển vông' })
    expect(filled.status).toBe(200)
    expect(filled.body.meaning).toBe('viển vông')

    const deck = await student.get('/study/flashcards?deck=notebook')
    expect(deck.body.cards.map((card: { word: string }) => card.word).sort()).toEqual(['invoice', 'invoice', 'quixotic'])
    const card = deck.body.cards.find((item: { meaning: string }) => item.meaning === 'hóa đơn')
    expect((await student.post('/study/flashcards/review').send({ kind: 'NOTEBOOK', id: card.id, result: 'GOOD' })).status).toBe(200)
    const after = await student.get('/study/flashcards?deck=notebook')
    expect(after.body.cards.find((item: { id: string }) => item.id === card.id)).toBeUndefined()

    const catalog = await student.get('/study/flashcards?deck=catalog')
    expect(catalog.body.cards.length).toBeGreaterThan(0)
    const grammar = await student.get('/study/grammar')
    expect(grammar.body.length).toBeGreaterThanOrEqual(6)
    const lessonId = grammar.body[0].id as string
    expect((await student.post(`/study/grammar/${lessonId}/progress`).send({ completed: true })).body.completed).toBe(true)
    const overview = await student.get('/study/overview')
    expect(overview.body.grammarCompleted).toBe(1)
    expect(overview.body.notebookTotal).toBe(3)

    const pdf = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
    expect((await postPdf(student, lessonId, 'bi-mat.pdf', pdf)).status).toBe(403)
    expect((await postPdf(admin, lessonId, 'khong-phai.pdf', Buffer.from('hello'))).status).toBe(400)
    const attached = await postPdf(admin, lessonId, 'hien-tai.pdf', pdf)
    expect(attached.status).toBe(200)
    expect(attached.body.pdf).toMatchObject({ filename: 'hien-tai.pdf', sizeBytes: pdf.length })
    const replaced = await postPdf(admin, lessonId, 'hien-tai-2.pdf', pdf)
    expect(replaced.body.pdf.filename).toBe('hien-tai-2.pdf')
    const downloaded = await student.agent.get(`/api/v1/study/grammar/${lessonId}/pdf`)
    expect(downloaded.status).toBe(200)
    expect(downloaded.headers['content-type']).toMatch(/application\/pdf/)
    expect(Buffer.from(downloaded.body).subarray(0, 5).toString()).toBe('%PDF-')
    expect((await admin.delete(`/study/grammar/${lessonId}/pdf`)).status).toBe(200)
    expect((await student.agent.get(`/api/v1/study/grammar/${lessonId}/pdf`)).status).toBe(404)
    expect((await student.get(`/study/grammar/${lessonId}`)).body.pdf).toBeNull()
  })
})

function postPdf(who: TestClient, lessonId: string, filename: string, body: Buffer) {
  return who.agent
    .post(`/api/v1/study/grammar/${lessonId}/pdf?filename=${encodeURIComponent(filename)}`)
    .set(CSRF_HEADER, CSRF_HEADER_VALUE)
    .set('content-type', 'application/pdf')
    .send(body)
}
