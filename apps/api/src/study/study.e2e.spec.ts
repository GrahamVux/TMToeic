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

  function importFile(who: TestClient, body: Buffer, set?: Record<string, string>) {
    const query = set ? `?${new URLSearchParams(set).toString()}` : ''
    return who.agent
      .post(`/api/v1/study/vocab/import${query}`)
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
    const set = { mode: 'new', topic: 'Công sở', title: 'Hóa đơn' }
    expect((await importFile(student, file, set)).status).toBe(403)
    expect((await importFile(admin, file)).status).toBe(400)
    const imported = await importFile(admin, file, set)
    expect(imported.status).toBe(200)
    expect(imported.body).toMatchObject({ imported: 2, skipped: 1, units: 1 })

    const listed = await student.get('/study/vocab?q=invoice')
    expect(listed.body.total).toBeGreaterThanOrEqual(2)
    expect(listed.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: 'invoice', partOfSpeech: 'noun', meaning: 'hóa đơn', set: { topic: 'Công sở', title: 'Hóa đơn', unit: 1 } }),
        expect.objectContaining({ word: 'invoice', partOfSpeech: 'verb', meaning: 'lập hóa đơn', set: { topic: 'Công sở', title: 'Hóa đơn', unit: 1 } }),
      ]),
    )

    const course = await student.get('/study/vocab/sets')
    expect(course.status).toBe(200)
    const courseSet = course.body.sets.find((item: { title: string }) => item.title === 'Hóa đơn')
    expect(courseSet).toMatchObject({ topic: 'Công sở', wordCount: 2, learnedCount: 0 })
    expect(courseSet.units).toEqual([expect.objectContaining({ index: 1, wordCount: 2, learnedCount: 0 })])
    const again = await importFile(admin, file, { mode: 'unit', setId: courseSet.id })
    expect(again.body).toMatchObject({ updated: 2, imported: 0, units: 0 })
    const unitCards = await student.get(`/study/flashcards?deck=catalog&setId=${courseSet.id}&unit=1`)
    expect(unitCards.status).toBe(200)
    expect(unitCards.body.title).toBe('Hóa đơn · Unit 1')
    expect(unitCards.body.cards).toHaveLength(2)
    expect((await student.post('/study/flashcards/review').send({ kind: 'CATALOG', id: unitCards.body.cards[0].id, result: 'GOOD' })).status).toBe(200)
    const learned = await student.get('/study/vocab/sets')
    expect(learned.body.sets.find((item: { id: string }) => item.id === courseSet.id).learnedCount).toBe(1)

    const extra = await workbook([
      ['Từ vựng', 'Loại từ', 'Nghĩa'],
      ['deadline', 'noun', 'hạn chót'],
    ])
    const added = await importFile(admin, extra, { mode: 'unit', setId: courseSet.id })
    expect(added.status).toBe(200)
    expect(added.body).toMatchObject({ imported: 1, units: 1 })
    const clash = await importFile(admin, extra, set)
    expect(clash.status).toBe(409)
    const grown = await student.get('/study/vocab/sets')
    const units = grown.body.sets.find((item: { id: string }) => item.id === courseSet.id).units
    expect(units).toEqual([
      expect.objectContaining({ index: 1, wordCount: 2 }),
      expect.objectContaining({ index: 2, wordCount: 1, learnedCount: 0 }),
    ])

    const styled = new ExcelJS.Workbook()
    const layout = styled.addWorksheet('Tu vung')
    layout.addRow(['Bộ đề', 'Demo'])
    layout.addRow([null, 'Unit', 1])
    layout.addRow([null, null, 'Từ vựng', 'Loại từ', 'Nghĩa'])
    layout.addRow([null, null, 'substantial', 'adjective', 'đáng kể, lớn, quan trọng'])
    layout.addRow([null, 'Unit', 2])
    layout.addRow([null, null, 'Từ vựng', 'Loại từ', 'Nghĩa'])
    layout.addRow([null, null, 'shipment', 'noun', 'lô hàng'])
    const recognized = await admin.agent
      .post('/api/v1/study/vocab/import')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(Buffer.from(await styled.xlsx.writeBuffer()))
    expect(recognized.status).toBe(200)
    expect(recognized.body).toMatchObject({ imported: 2, units: 2 })
    const demo = (await student.get('/study/vocab/sets')).body.sets.find((item: { title: string }) => item.title === 'Demo')
    expect(demo).toMatchObject({ topic: 'Từ vựng', wordCount: 2 })
    expect(demo.units).toEqual([
      expect.objectContaining({ index: 1, wordCount: 1 }),
      expect.objectContaining({ index: 2, wordCount: 1 }),
    ])

    const saved = await student.post('/study/notebook').send({ word: 'invoice' })
    expect(saved.status).toBe(200)
    expect(saved.body.alreadySaved).toBe(false)
    expect(saved.body.entries).toHaveLength(2)

    const duplicate = await student.post('/study/notebook').send({ word: 'invoice,' })
    expect(duplicate.body.alreadySaved).toBe(true)

    const unknown = await student.post('/study/notebook').send({ word: 'quixotic' })
    expect(unknown.body.entries[0]).toMatchObject({ word: 'quixotic', partOfSpeech: null, meaning: null, source: 'EXAM' })

    const phrase = await student.post('/study/notebook').send({ word: 'two words' })
    expect(phrase.status).toBe(200)
    expect(phrase.body.entries[0]).toMatchObject({ word: 'two words', source: 'EXAM', meaning: null })

    const notebook = await student.get('/study/notebook')
    expect(notebook.body.total).toBe(4)
    expect(notebook.body.missingMeaning).toBe(2)

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
    const manual = await student.post('/study/notebook').send({ word: 'take off', partOfSpeech: 'phrasal verb', meaning: 'cất cánh', manual: true })
    expect(manual.status).toBe(200)
    expect(manual.body.entries[0]).toMatchObject({ word: 'take off', source: 'MANUAL', partOfSpeech: 'phrasal verb', meaning: 'cất cánh' })

    expect(overview.body.notebookTotal).toBe(4)

    const personal = await workbook([
      ['Từ vựng', 'Loại từ', 'Nghĩa'],
      ['deadline', 'noun', 'hạn chót'],
      ['meet the deadline', 'phrase', 'kịp hạn'],
      ['123', 'noun', 'không phải từ'],
    ])
    const importedList = await student.agent
      .post('/api/v1/study/notebook/import')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(personal)
    expect(importedList.status).toBe(200)
    expect(importedList.body).toMatchObject({ added: 2, updated: 0 })
    expect(importedList.body.skipped).toBeGreaterThanOrEqual(1)
    const againList = await student.agent
      .post('/api/v1/study/notebook/import')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(personal)
    expect(againList.body.updated).toBe(2)
    const afterImport = await student.get('/study/notebook')
    expect(afterImport.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ word: 'deadline', source: 'MANUAL', meaning: 'hạn chót', partOfSpeech: 'noun' })]),
    )
    const sample = await student.agent.get('/api/v1/study/notebook/template')
    expect(sample.status).toBe(200)
    expect(sample.headers['content-type']).toMatch(/spreadsheetml/)

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

  it('supports Excel preview/commit staging, inline unit edits, notebook topic/unit/color inheritance, and capped game EXP', async () => {
    const sampleTpl = await admin.agent.get('/api/v1/study/vocab/template')
    expect(sampleTpl.status).toBe(200)

    const sheet = await workbook([
      ['Bộ đề', 'Hợp đồng nâng cao'],
      ['', 'Unit', '1'],
      ['', '', 'Từ vựng', 'Loại từ', 'Nghĩa', 'Câu mẫu'],
      ['', '', 'substantial', 'adjective', 'đáng kể, lớn, quan trọng', 'The company saw a substantial rise in revenue this year.'],
      ['', 'Unit', '2'],
      ['', '', 'Từ vựng', 'Loại từ', 'Nghĩa'],
      ['', '', 'compliance', 'noun', 'sự tuân thủ', 'Full compliance is required by Friday.'],
    ])
    const preview = await admin.agent
      .post('/api/v1/study/vocab/preview')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(sheet)
    expect(preview.status).toBe(200)
    expect(preview.body.suggestedTitle).toBe('Hợp đồng nâng cao')
    expect(preview.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit: 1, word: 'substantial', status: 'UPDATE' }),
        expect.objectContaining({ unit: 2, word: 'compliance', example: 'Full compliance is required by Friday.', status: 'NEW' }),
      ]),
    )

    const committed = await admin.post('/study/vocab/commit').send({
      mode: 'new',
      topic: 'Pháp lý',
      title: 'Hợp đồng nâng cao',
      rows: preview.body.rows.map((r: { unit: number; word: string; partOfSpeech: string; meaning: string; example: string }) =>
        r.word === 'compliance' ? { ...r, meaning: 'sự tuân thủ quy định' } : r,
      ),
    })
    expect(committed.status).toBe(200)
    expect(committed.body.imported).toBeGreaterThanOrEqual(1)

    const sets = (await student.get('/study/vocab/sets')).body.sets as Array<{ id: string; title: string }>
    const legalSet = sets.find((s) => s.title === 'Hợp đồng nâng cao')!
    const unit2 = await student.get(`/study/vocab/sets/${legalSet.id}/units/2`)
    expect(unit2.status).toBe(200)
    const compWord = unit2.body.items.find((i: { word: string }) => i.word === 'compliance')
    expect(compWord).toMatchObject({ meaning: 'sự tuân thủ quy định', example: 'Full compliance is required by Friday.', savedInNotebook: false })

    const patched = await admin.agent
      .patch(`/api/v1/study/vocab/${compWord.id}`)
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .send({ word: 'compliance', partOfSpeech: 'noun', meaning: 'tuân thủ bắt buộc', example: 'Safety compliance matters.' })
    expect(patched.status).toBe(200)
    expect(patched.body.meaning).toBe('tuân thủ bắt buộc')

    const saved = await student.post('/study/notebook').send({ vocabEntryId: compWord.id })
    expect(saved.status).toBe(200)
    const noteRow = saved.body.entries[0]
    expect(noteRow).toMatchObject({ topic: 'Pháp lý', unit: 2, example: 'Safety compliance matters.', color: 'default' })

    const recolored = await student.patch(`/study/notebook/${noteRow.id}`).send({ color: 'rose' })
    expect(recolored.status).toBe(200)
    expect(recolored.body.color).toBe('rose')

    for (let i = 0; i < 4; i++) {
      const g = await student.post('/study/games/complete').send({
        gameKind: 'QUIZ',
        deckLabel: 'Pháp lý · Unit 2',
        score: 30,
        totalItems: 30,
        reviewedCards: [{ kind: 'NOTEBOOK', id: noteRow.id, result: 'GOOD' }],
      })
      expect(g.status).toBe(200)
    }
    const statusRes = await student.get('/study/games/status')
    expect(statusRes.status).toBe(200)
    expect(statusRes.body.todayGameXp).toBe(40)
  })
})

function postPdf(who: TestClient, lessonId: string, filename: string, body: Buffer) {
  return who.agent
    .post(`/api/v1/study/grammar/${lessonId}/pdf?filename=${encodeURIComponent(filename)}`)
    .set(CSRF_HEADER, CSRF_HEADER_VALUE)
    .set('content-type', 'application/pdf')
    .send(body)
}
