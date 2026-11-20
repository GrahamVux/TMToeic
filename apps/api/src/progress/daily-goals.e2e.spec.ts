import type { INestApplication } from '@nestjs/common'
import { ERROR_CODES, VIEW_AS_HEADER, type DailyGoalsDto } from '@toeic/shared'
import { eq, inArray } from 'drizzle-orm'
import { DB, type Db } from '../db/database.module'
import { attempts, cardReviews, dailyGoals } from '../db/schema'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'

const LAYOUT = [
  { partCode: 'PART_1', questionStart: 1, questionEnd: 2 },
  { partCode: 'PART_5', questionStart: 101, questionEnd: 102 },
]

describe('Daily study goals (e2e on PGlite)', () => {
  let app: INestApplication
  let admin: TestClient
  let seq = 0
  const put = (c: TestClient, url: string, body: object) => c.agent.put(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)
  const goals = async (c: TestClient) => (await c.get('/me/daily-goals')).body as DailyGoalsDto

  async function newStudent(name: string) {
    const created = await admin.post('/users/students').send({ fullName: name })
    const temp = created.body.temporaryPassword as string
    const { c } = await login(app, created.body.user.studentCode, temp)
    expect((await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'StudentPass99' })).status).toBe(200)
    return { c, id: created.body.user.id as string }
  }

  async function publishedExam() {
    const res = await admin.post('/exams').send({ code: `DG-${++seq}-${Date.now()}`, title: `Daily goal exam ${seq}`, durationSeconds: 3600, parts: LAYOUT })
    const id = res.body.id as string
    const questions = LAYOUT.flatMap((p) =>
      Array.from({ length: p.questionEnd - p.questionStart + 1 }, (_, i) => ({
        partCode: p.partCode,
        number: p.questionStart + i,
        prompt: `Q${p.questionStart + i}`,
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key, correct: key === 'A' })),
      })),
    )
    expect((await put(admin, `/exams/${id}/content`, { groups: [], questions })).status).toBe(200)
    expect((await admin.post(`/exams/${id}/publish`)).status).toBe(200)
    return id
  }

  /** Answer the questions of the given parts in one sitting. Returns the attempt id. */
  async function sit(c: TestClient, examId: string, partCodes: string[], submit = true) {
    const start = await c.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE', partCodes })
    const id = start.body.id as string
    expect(id).toBeTruthy()
    const { questions } = (await c.get(`/attempts/${id}`)).body as { questions: Array<{ id: string }> }
    for (const q of questions) expect((await put(c, `/attempts/${id}/answers/${q.id}`, { selectedKey: 'A' })).status).toBe(200)
    if (submit) expect((await c.post(`/attempts/${id}/submit`)).status).toBe(200)
    return id
  }

  beforeAll(async () => {
    app = await createTestApp()
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
  })
  afterAll(async () => {
    await app.close()
  })

  it('is student-only', async () => {
    expect((await admin.get('/me/daily-goals')).status).toBe(403)
    expect((await put(admin, '/me/daily-goals', { reading: 1, listening: 1, vocab: 10 })).status).toBe(403)
  })

  it('a new account has no targets and nothing done', async () => {
    const { c } = await newStudent('Chưa Đặt Ngày')
    const d = await goals(c)
    expect(d).toMatchObject({
      configured: false,
      targets: { reading: 0, listening: 0, vocab: 0 },
      done: { reading: 0, listening: 0, vocab: 0 },
    })
    expect(d.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('saves targets, lets the student change them, and rejects values out of range', async () => {
    const { c } = await newStudent('Đặt Mục Tiêu Ngày')
    const saved = await put(c, '/me/daily-goals', { reading: 2, listening: 1, vocab: 20 })
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ configured: true, targets: { reading: 2, listening: 1, vocab: 20 } })
    expect((await goals(c)).targets).toEqual({ reading: 2, listening: 1, vocab: 20 })

    expect((await put(c, '/me/daily-goals', { reading: 0, listening: 3, vocab: 0 })).status).toBe(200)
    expect(await goals(c)).toMatchObject({ configured: true, targets: { reading: 0, listening: 3, vocab: 0 } })

    for (const bad of [
      { reading: -1, listening: 1, vocab: 10 },
      { reading: 21, listening: 1, vocab: 10 },
      { reading: 1, listening: 1, vocab: 201 },
      { reading: 1.5, listening: 1, vocab: 10 },
      { reading: 1, listening: 1 },
      {},
    ]) {
      expect((await put(c, '/me/daily-goals', bad)).status).toBe(400)
    }
    expect((await goals(c)).targets).toEqual({ reading: 0, listening: 3, vocab: 0 })
  })

  it('counts today’s finished sittings per skill, and leaves out unfinished and earlier ones', async () => {
    const examId = await publishedExam()
    const { c } = await newStudent('Làm Bài Hôm Nay')

    await sit(c, examId, ['PART_5'])
    expect((await goals(c)).done).toEqual({ reading: 1, listening: 0, vocab: 0 })

    // One sitting that covers both skills counts once for each.
    await sit(c, examId, ['PART_1', 'PART_5'])
    expect((await goals(c)).done).toEqual({ reading: 2, listening: 1, vocab: 0 })

    await sit(c, examId, ['PART_1'], false)
    expect((await goals(c)).done).toEqual({ reading: 2, listening: 1, vocab: 0 })

    const old = await sit(c, examId, ['PART_5'])
    expect((await goals(c)).done.reading).toBe(3)
    await app
      .get<Db>(DB)
      .update(attempts)
      .set({ submittedAt: new Date(Date.now() - 2 * 86_400_000) })
      .where(eq(attempts.id, old))
    expect((await goals(c)).done).toEqual({ reading: 2, listening: 1, vocab: 0 })
  })

  it('counts each flashcard reviewed today once', async () => {
    const { c } = await newStudent('Ôn Thẻ Hôm Nay')
    const cardIds: string[] = []
    for (const word of ['invoice', 'deadline']) {
      const saved = await c.post('/study/notebook').send({ word, partOfSpeech: 'n', meaning: 'nghĩa', manual: true })
      expect(saved.status).toBe(200)
      cardIds.push(saved.body.entries[0].id as string)
    }
    const review = (cardId: string, result: 'AGAIN' | 'GOOD') => c.post('/study/flashcards/review').send({ kind: 'NOTEBOOK', id: cardId, result })

    expect((await review(cardIds[0], 'AGAIN')).status).toBe(200)
    expect((await review(cardIds[0], 'GOOD')).status).toBe(200)
    expect((await goals(c)).done.vocab).toBe(1)
    expect((await review(cardIds[1], 'GOOD')).status).toBe(200)
    expect((await goals(c)).done).toEqual({ reading: 0, listening: 0, vocab: 2 })

    await app
      .get<Db>(DB)
      .update(cardReviews)
      .set({ updatedAt: new Date(Date.now() - 2 * 86_400_000) })
      .where(eq(cardReviews.notebookEntryId, cardIds[0]))
    expect((await goals(c)).done.vocab).toBe(1)
  })

  it('shows how far yesterday fell short or ran ahead, and ignores a goal saved today', async () => {
    const examId = await publishedExam()
    const { c, id } = await newStudent('Hôm Qua')
    expect((await put(c, '/me/daily-goals', { reading: 1, listening: 1, vocab: 5 })).status).toBe(200)
    const today = (await goals(c)).day
    const [year, month, date] = today.split('-').map(Number)
    const yesterdayNoon = new Date(Date.UTC(year, month - 1, date - 1, 5, 0, 0))
    const db = app.get<Db>(DB)
    await db
      .update(dailyGoals)
      .set({ createdAt: new Date(yesterdayNoon.getTime() - 3 * 86_400_000) })
      .where(eq(dailyGoals.userId, id))

    const reading = await sit(c, examId, ['PART_5'])
    const listening = await sit(c, examId, ['PART_1'])
    const extra = await sit(c, examId, ['PART_1'])
    await db.update(attempts).set({ submittedAt: yesterdayNoon }).where(inArray(attempts.id, [reading, listening, extra]))

    const report = await goals(c)
    expect(report.done).toEqual({ reading: 0, listening: 0, vocab: 0 })
    expect(report.yesterday).toMatchObject({
      done: { reading: 1, listening: 2, vocab: 0 },
      delta: { reading: 0, listening: 1, vocab: -5 },
      met: false,
    })

    const newbie = await newStudent('Mới Đặt Hôm Nay')
    expect((await put(newbie.c, '/me/daily-goals', { reading: 1, listening: 1, vocab: 5 })).status).toBe(200)
    expect((await goals(newbie.c)).yesterday).toBeNull()
  })

  it('keeps each student’s targets and progress to themselves', async () => {
    const examId = await publishedExam()
    const a = await newStudent('Riêng Ngày A')
    const b = await newStudent('Riêng Ngày B')
    expect((await put(a.c, '/me/daily-goals', { reading: 5, listening: 5, vocab: 50 })).status).toBe(200)
    await sit(a.c, examId, ['PART_5'])
    expect(await goals(b.c)).toMatchObject({ configured: false, targets: { reading: 0, listening: 0, vocab: 0 }, done: { reading: 0, listening: 0, vocab: 0 } })
  })

  it('an admin previewing a student sees the targets and cannot change them', async () => {
    const { c, id } = await newStudent('Xem Thử Ngày')
    expect((await put(c, '/me/daily-goals', { reading: 1, listening: 2, vocab: 30 })).status).toBe(200)

    const seen = await admin.get('/me/daily-goals').set(VIEW_AS_HEADER, id)
    expect(seen.status).toBe(200)
    expect(seen.body.targets).toEqual({ reading: 1, listening: 2, vocab: 30 })

    const changed = await put(admin, '/me/daily-goals', { reading: 9, listening: 9, vocab: 90 }).set(VIEW_AS_HEADER, id)
    expect(changed.status).toBe(403)
    expect(changed.body.error.code).toBe(ERROR_CODES.VIEW_ONLY)
    expect((await goals(c)).targets).toEqual({ reading: 1, listening: 2, vocab: 30 })
  })
})
