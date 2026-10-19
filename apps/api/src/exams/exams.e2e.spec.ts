import type { INestApplication } from '@nestjs/common'
import { ERROR_CODES } from '@toeic/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { DB, type Db } from '../db/database.module'
import { attemptFocusLeaves, attempts } from '../db/schema'
import { ADMIN, client, createTestApp, login, type TestClient } from '../test/test-app'
import { scaledSectionScore } from './scoring'

type Q = { id: string; number: number; partCode: string; options: Array<{ key: string }>; selectedKey: string | null }

// Real TOEIC L&R layout — Part is data, so this is just configuration.
const FULL_LAYOUT = [
  { partCode: 'PART_1', questionStart: 1, questionEnd: 6 },
  { partCode: 'PART_2', questionStart: 7, questionEnd: 31 },
  { partCode: 'PART_3', questionStart: 32, questionEnd: 70 },
  { partCode: 'PART_4', questionStart: 71, questionEnd: 100 },
  { partCode: 'PART_5', questionStart: 101, questionEnd: 130 },
  { partCode: 'PART_6', questionStart: 131, questionEnd: 146 },
  { partCode: 'PART_7', questionStart: 147, questionEnd: 200 },
]
const SMALL_LAYOUT = [
  { partCode: 'PART_1', questionStart: 1, questionEnd: 3 },
  { partCode: 'PART_5', questionStart: 101, questionEnd: 105 },
]

/** Builds content where option A is correct for every question, except numbers in `wrongAt` (correct = B). */
function content(layout: typeof SMALL_LAYOUT, opts: { withGroup?: boolean } = {}) {
  const questions = layout.flatMap((p) =>
    Array.from({ length: p.questionEnd - p.questionStart + 1 }, (_, i) => {
      const number = p.questionStart + i
      return {
        partCode: p.partCode,
        number,
        prompt: `Question ${number}`,
        ...(opts.withGroup && p.partCode === 'PART_5' && number === 101 ? { groupKey: 'g1' } : {}),
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `opt ${key} for ${number}`, correct: key === 'A' })),
      }
    }),
  )
  const groups = opts.withGroup ? [{ key: 'g1', partCode: 'PART_5', passages: [{ label: 'A', title: 'Email', content: 'Dear team…' }] }] : []
  return { groups, questions }
}

describe('Exam engine (e2e on PGlite)', () => {
  let app: INestApplication
  let db: Db
  let admin: TestClient
  let student: TestClient
  let otherStudent: TestClient
  let seq = 0

  async function newStudent(name: string): Promise<TestClient> {
    const created = await admin.post('/users/students').send({ fullName: name })
    const code = created.body.user.studentCode as string
    const temp = created.body.temporaryPassword as string
    const { c } = await login(app, code, temp)
    const ch = await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'StudentPass99' })
    expect(ch.status).toBe(200)
    return c
  }

  async function publishedExam(layout: typeof SMALL_LAYOUT, o: { duration?: number; withGroup?: boolean } = {}) {
    const code = `T-${++seq}-${Date.now()}`
    const res = await admin.post('/exams').send({ code, title: `Test exam ${seq}`, durationSeconds: o.duration ?? 7200, parts: layout })
    expect(res.status).toBe(201)
    const id = res.body.id as string
    expect((await admin.agent.put(`/api/v1/exams/${id}/content`).set('x-toeic-client', 'web').send(content(layout, o))).status).toBe(200)
    const pub = await admin.post(`/exams/${id}/publish`)
    expect(pub.status).toBe(200)
    return id
  }

  const put = (c: TestClient, url: string, body: object) => c.agent.put(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)

  beforeAll(async () => {
    app = await createTestApp()
    db = app.get<Db>(DB)
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
    student = await newStudent('Học Viên Một')
    otherStudent = await newStudent('Học Viên Hai')
  })
  afterAll(async () => {
    await app.close()
  })

  describe('exam authoring & publishing', () => {
    let examId: string

    it('students cannot author exams; staff create a DRAFT that students cannot see', async () => {
      expect((await student.post('/exams').send({ code: 'X-1', title: 'Nope nope', durationSeconds: 600, parts: SMALL_LAYOUT })).status).toBe(403)

      const res = await admin.post('/exams').send({ code: 'DRAFT-1', title: 'Draft exam', durationSeconds: 1800, parts: SMALL_LAYOUT })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('DRAFT')
      expect(res.body.totalQuestions).toBe(8)
      expect(res.body.parts.map((p: { code: string; skill: string }) => [p.code, p.skill])).toEqual([
        ['PART_1', 'LISTENING'],
        ['PART_5', 'READING'],
      ])
      examId = res.body.id

      expect((await student.get(`/exams/${examId}`)).status).toBe(404)
      const list = await student.get('/exams')
      expect(list.body.find((e: { id: string }) => e.id === examId)).toBeUndefined()
      expect((await admin.get('/exams')).body.some((e: { id: string }) => e.id === examId)).toBe(true)
    })

    it('validates the exam definition', async () => {
      const bad = (parts: unknown, extra: object = {}) => admin.post('/exams').send({ code: `V-${++seq}`, title: 'Validation', durationSeconds: 600, parts, ...extra })
      expect((await bad([{ partCode: 'PART_1', questionStart: 1, questionEnd: 6 }, { partCode: 'PART_2', questionStart: 6, questionEnd: 10 }])).status).toBe(400) // overlap
      expect((await bad([{ partCode: 'PART_9', questionStart: 1, questionEnd: 2 }])).status).toBe(400) // unknown part
      expect((await bad([{ partCode: 'PART_1', questionStart: 5, questionEnd: 2 }])).status).toBe(400) // reversed range
      expect((await admin.post('/exams').send({ code: 'DRAFT-1', title: 'Duplicate code', durationSeconds: 600, parts: SMALL_LAYOUT })).status).toBe(409)
    })

    it('rejects invalid content and blocks publishing incomplete exams with a clear problem list', async () => {
      const notReady = await admin.post(`/exams/${examId}/publish`)
      expect(notReady.status).toBe(409)
      expect(notReady.body.error.code).toBe(ERROR_CODES.EXAM_NOT_READY)
      expect(notReady.body.error.details.problems.join(' ')).toMatch(/PART_1: thiếu 3 câu/)

      const c = content(SMALL_LAYOUT)
      const outOfRange = await put(admin, `/exams/${examId}/content`, { ...c, questions: [{ ...c.questions[0], number: 50 }] })
      expect(outOfRange.status).toBe(400)
      expect(outOfRange.body.error.details.problems[0]).toMatch(/ngoài khoảng/)

      const twoCorrect = await put(admin, `/exams/${examId}/content`, {
        groups: [],
        questions: [{ ...c.questions[0], options: c.questions[0].options.map((o) => ({ ...o, correct: true })) }],
      })
      expect(twoCorrect.status).toBe(400)

      // Fill everything but leave question 2 without a correct answer → still not publishable
      const noKey = c.questions.map((q) => (q.number === 2 ? { ...q, options: q.options.map((o) => ({ ...o, correct: false })) } : q))
      expect((await put(admin, `/exams/${examId}/content`, { groups: [], questions: noKey })).status).toBe(200)
      const still = await admin.post(`/exams/${examId}/publish`)
      expect(still.status).toBe(409)
      expect(still.body.error.details.problems.join(' ')).toMatch(/Câu 2: phải có đúng 1 đáp án đúng/)
    })

    it('publishes a complete exam; students see it but never the answer key endpoint', async () => {
      expect((await put(admin, `/exams/${examId}/content`, content(SMALL_LAYOUT, { withGroup: true }))).status).toBe(200)
      const pub = await admin.post(`/exams/${examId}/publish`)
      expect(pub.status).toBe(200)
      expect(pub.body.status).toBe('PUBLISHED')
      expect(pub.body.publishedAt).toBeTruthy()

      expect((await student.get('/exams')).body.some((e: { id: string }) => e.id === examId)).toBe(true)
      expect((await student.get(`/exams/${examId}`)).status).toBe(200)
      expect((await student.get(`/exams/${examId}/content`)).status).toBe(403)
      const staffContent = await admin.get(`/exams/${examId}/content`)
      expect(staffContent.status).toBe(200)
      expect(staffContent.body.questions).toHaveLength(8)
      expect(staffContent.body.groups[0].passages[0].content).toBe('Dear team…')
    })

    it('published content is immutable; archive hides the exam from new starts', async () => {
      const edit = await put(admin, `/exams/${examId}/content`, content(SMALL_LAYOUT))
      expect(edit.status).toBe(409)
      expect((await admin.post(`/exams/${examId}/archive`)).status).toBe(200)
      expect((await student.get('/exams')).body.some((e: { id: string }) => e.id === examId)).toBe(false)
      expect((await student.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })).status).toBe(404)
      // can be republished
      expect((await admin.post(`/exams/${examId}/publish`)).status).toBe(200)
    })

    it('audits authoring actions', async () => {
      const { auditLogs } = await import('../db/schema')
      const rows = await db.select().from(auditLogs)
      const actions = new Set(rows.map((r) => r.action))
      for (const a of ['EXAM_CREATED', 'EXAM_CONTENT_REPLACED', 'EXAM_PUBLISHED', 'EXAM_ARCHIVED']) expect(actions).toContain(a)
    })
  })

  describe('taking an exam (practice flow)', () => {
    let examId: string
    let attemptId: string
    let qs: Q[]

    beforeAll(async () => {
      examId = await publishedExam(SMALL_LAYOUT, { withGroup: true })
    })

    it('staff cannot start attempts; students can, and the player payload never exposes the answer key', async () => {
      expect((await admin.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })).status).toBe(403)

      const start = await student.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      expect(start.status).toBe(200)
      expect(start.body.status).toBe('IN_PROGRESS')
      expect(start.body.deadlineAt).toBeNull()
      expect(start.body.totalQuestions).toBe(8)
      attemptId = start.body.id

      const player = await student.get(`/attempts/${attemptId}`)
      expect(player.status).toBe(200)
      qs = player.body.questions
      expect(qs.map((q) => q.number)).toEqual([1, 2, 3, 101, 102, 103, 104, 105])
      expect(qs[0].options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D'])
      const raw = JSON.stringify(player.body)
      expect(raw).not.toMatch(/correct/i)
      expect(player.body.groups[0].passages[0].label).toBe('A')
      expect(qs.find((q) => q.number === 101)).toMatchObject({ groupId: player.body.groups[0].id })
    })

    it('starting again resumes the same attempt instead of duplicating', async () => {
      const again = await student.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      expect(again.body.id).toBe(attemptId)
      // a different mode/scope is a different attempt
      const drill = await student.post(`/exams/${examId}/attempts`).send({ mode: 'PART_DRILL', partCodes: ['PART_5'] })
      expect(drill.body.id).not.toBe(attemptId)
      expect(drill.body.totalQuestions).toBe(5)
      expect(drill.body.partCodes).toEqual(['PART_5'])
      // the other student gets their own
      const other = await otherStudent.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      expect(other.body.id).not.toBe(attemptId)
    })

    it('autosaves answers (idempotent upsert), supports change & clear, and restores them on resume', async () => {
      const q1 = qs[0]
      expect((await put(student, `/attempts/${attemptId}/answers/${q1.id}`, { selectedKey: 'A', timeSpentSeconds: 12 })).status).toBe(200)
      expect((await put(student, `/attempts/${attemptId}/answers/${q1.id}`, { selectedKey: 'A', timeSpentSeconds: 12 })).status).toBe(200) // retry
      expect((await put(student, `/attempts/${attemptId}/answers/${qs[1].id}`, { selectedKey: 'C' })).status).toBe(200)
      expect((await put(student, `/attempts/${attemptId}/answers/${qs[1].id}`, { selectedKey: 'B' })).status).toBe(200) // change
      expect((await put(student, `/attempts/${attemptId}/answers/${qs[2].id}`, { selectedKey: 'D' })).status).toBe(200)
      expect((await put(student, `/attempts/${attemptId}/answers/${qs[2].id}`, { selectedKey: null })).status).toBe(200) // clear

      const resumed = await student.get(`/attempts/${attemptId}`)
      const byNumber = Object.fromEntries((resumed.body.questions as Q[]).map((q) => [q.number, q.selectedKey]))
      expect(byNumber).toMatchObject({ 1: 'A', 2: 'B', 3: null })
      expect(resumed.body.attempt.answeredCount).toBe(2)

      expect((await put(student, `/attempts/${attemptId}/answers/${q1.id}`, { selectedKey: 'E' })).status).toBe(400)
      expect((await put(student, `/attempts/${attemptId}/answers/3fa85f64-5717-4562-b3fc-2c963f66afa6`, { selectedKey: 'A' })).status).toBe(404)
    })

    it("other students cannot read or modify someone else's attempt", async () => {
      expect((await otherStudent.get(`/attempts/${attemptId}`)).status).toBe(404)
      expect((await put(otherStudent, `/attempts/${attemptId}/answers/${qs[0].id}`, { selectedKey: 'B' })).status).toBe(404)
      expect((await otherStudent.post(`/attempts/${attemptId}/submit`)).status).toBe(404)
      expect((await otherStudent.get(`/attempts/${attemptId}/review`)).status).toBe(404)
    })

    it('no result or review before submitting', async () => {
      expect((await student.get(`/attempts/${attemptId}/result`)).status).toBe(409)
      expect((await student.get(`/attempts/${attemptId}/review`)).status).toBe(409)
    })

    it('answer more, then submit: scored once, duplicate submits return the same result', async () => {
      await put(student, `/attempts/${attemptId}/answers/${qs[3].id}`, { selectedKey: 'A' }) // 101 ✓
      await put(student, `/attempts/${attemptId}/answers/${qs[4].id}`, { selectedKey: 'B' }) // 102 ✗
      // q 103..105 unanswered

      const first = await student.post(`/attempts/${attemptId}/submit`)
      expect(first.status).toBe(200)
      const second = await student.post(`/attempts/${attemptId}/submit`)
      expect(second.status).toBe(200)
      expect(second.body).toEqual(first.body)

      const r = first.body
      expect(r.attempt.status).toBe('SUBMITTED')
      expect(r.correctCount).toBe(2) // Q1 (A) + Q101 (A); Q2=B wrong, Q102=B wrong
      expect(r.incorrectCount).toBe(2)
      expect(r.unansweredCount).toBe(4)
      // partial coverage → no misleading 990-scale score
      expect(r.totalScore).toBeNull()
      expect(r.listeningScore).toBeNull()
      const p1 = r.parts.find((p: { partCode: string }) => p.partCode === 'PART_1')
      expect(p1).toMatchObject({ total: 3, correct: 1, accuracy: 33 })

      expect((await student.get(`/attempts/${attemptId}/result`)).body).toEqual(first.body)
    })

    it('closed attempts reject answer changes; review reveals the key only now', async () => {
      const late = await put(student, `/attempts/${attemptId}/answers/${qs[0].id}`, { selectedKey: 'B' })
      expect(late.status).toBe(409)
      expect(late.body.error.code).toBe(ERROR_CODES.ATTEMPT_CLOSED)

      const review = await student.get(`/attempts/${attemptId}/review`)
      expect(review.status).toBe(200)
      const byNum = Object.fromEntries(review.body.questions.map((q: { number: number }) => [q.number, q]))
      expect(byNum[1]).toMatchObject({ correctKey: 'A', selectedKey: 'A', isCorrect: true })
      expect(byNum[2]).toMatchObject({ correctKey: 'A', selectedKey: 'B', isCorrect: false })
      expect(byNum[103]).toMatchObject({ correctKey: 'A', selectedKey: null, isCorrect: null })
    })

    it('staff can read a student’s result and review but cannot play, change answers, or submit', async () => {
      expect((await admin.get(`/attempts/${attemptId}/result`)).status).toBe(200)
      const review = await admin.get(`/attempts/${attemptId}/review`)
      expect(review.status).toBe(200)
      expect(review.body.questions[0]).toMatchObject({ correctKey: 'A' })
      expect((await admin.get(`/attempts/${attemptId}`)).status).toBe(403)
      expect((await put(admin, `/attempts/${attemptId}/answers/${qs[0].id}`, { selectedKey: 'C' })).status).toBe(403)
      expect((await admin.post(`/attempts/${attemptId}/submit`)).status).toBe(403)
    })

    it('history lists own attempts only; a finished attempt does not block a fresh start', async () => {
      const mine = await student.get('/attempts')
      expect(mine.status).toBe(200)
      expect(mine.body.some((a: { attempt: { id: string } }) => a.attempt.id === attemptId)).toBe(true)
      const theirs = await otherStudent.get('/attempts')
      expect(theirs.body.some((a: { attempt: { id: string } }) => a.attempt.id === attemptId)).toBe(false)

      const retake = await student.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      expect(retake.body.id).not.toBe(attemptId)
      expect(retake.body.status).toBe('IN_PROGRESS')
    })

    it('PART_DRILL requires parts; unknown parts are rejected', async () => {
      expect((await student.post(`/exams/${examId}/attempts`).send({ mode: 'PART_DRILL' })).status).toBe(400)
      expect((await student.post(`/exams/${examId}/attempts`).send({ mode: 'PART_DRILL', partCodes: ['PART_7'] })).status).toBe(400)
      expect((await student.post(`/exams/${examId}/attempts`).send({ mode: 'RANDOM' })).status).toBe(400)
    })
  })

  describe('timed attempts', () => {
    it('auto-closes after the deadline: late answers are refused and the attempt is scored as EXPIRED', async () => {
      const examId = await publishedExam(SMALL_LAYOUT, { duration: 3600 })
      const start = await student.post(`/exams/${examId}/attempts`).send({ mode: 'FULL_TEST' })
      expect(start.body.deadlineAt).toBeTruthy()
      expect(start.body.remainingSeconds).toBeGreaterThan(3500)
      const id = start.body.id as string

      const qs = (await student.get(`/attempts/${id}`)).body.questions as Q[]
      await put(student, `/attempts/${id}/answers/${qs[0].id}`, { selectedKey: 'A' })

      // Simulate the clock running out
      await db.update(attempts).set({ deadlineAt: new Date(Date.now() - 60_000) }).where(eq(attempts.id, id))

      const late = await put(student, `/attempts/${id}/answers/${qs[1].id}`, { selectedKey: 'A' })
      expect(late.status).toBe(409)
      expect(late.body.error.code).toBe(ERROR_CODES.ATTEMPT_CLOSED)

      const result = await student.get(`/attempts/${id}/result`)
      expect(result.status).toBe(200)
      expect(result.body.attempt.status).toBe('EXPIRED')
      expect(result.body.correctCount).toBe(1) // answers saved before the deadline still count
      expect(result.body.unansweredCount).toBe(7)
      // submit after expiry is harmless and returns the same result
      expect((await student.post(`/attempts/${id}/submit`)).body.attempt.status).toBe('EXPIRED')

      // a new FULL_TEST can be started afterwards
      const again = await student.post(`/exams/${examId}/attempts`).send({ mode: 'FULL_TEST' })
      expect(again.body.id).not.toBe(id)
    })
  })

  describe('demo exam seeding (dev convenience)', () => {
    it('is off by default in tests and produces a valid published exam when enabled', async () => {
      expect((await admin.get('/exams')).body.some((e: { code: string }) => e.code === 'DEMO-READING-01')).toBe(false)

      const demoApp = await createTestApp({ SEED_DEMO_EXAM: 'true' })
      try {
        const a = await login(demoApp, ADMIN.username, ADMIN.password)
        await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
        const list = await a.c.get('/exams')
        const demo = list.body.find((e: { code: string }) => e.code === 'DEMO-READING-01')
        expect(demo).toMatchObject({ status: 'PUBLISHED', totalQuestions: 19 })
        expect(demo.parts.map((p: { code: string }) => p.code)).toEqual(['PART_5', 'PART_6', 'PART_7'])
      } finally {
        await demoApp.close()
      }
    })
  })

  describe('full test scoring (200 questions)', () => {
    it('produces Listening / Reading / Total scaled scores and per-part accuracy', async () => {
      const examId = await publishedExam(FULL_LAYOUT as typeof SMALL_LAYOUT)
      const start = await student.post(`/exams/${examId}/attempts`).send({ mode: 'FULL_TEST' })
      expect(start.body.totalQuestions).toBe(200)
      const id = start.body.id as string
      const { questions } = (await student.get(`/attempts/${id}`)).body as { questions: Q[] }
      expect(questions).toHaveLength(200)

      // Listening: first 90 of 100 correct (A), 10 wrong. Reading: first 80 of 100 correct, 10 wrong, 10 blank.
      const listening = questions.filter((q) => q.number <= 100)
      const reading = questions.filter((q) => q.number > 100)
      for (const [i, q] of listening.entries()) await put(student, `/attempts/${id}/answers/${q.id}`, { selectedKey: i < 90 ? 'A' : 'B' })
      for (const [i, q] of reading.entries()) if (i < 90) await put(student, `/attempts/${id}/answers/${q.id}`, { selectedKey: i < 80 ? 'A' : 'C' })

      const res = await student.post(`/attempts/${id}/submit`)
      expect(res.status).toBe(200)
      const r = res.body
      expect(r.correctCount).toBe(170)
      expect(r.incorrectCount).toBe(20)
      expect(r.unansweredCount).toBe(10)
      expect(r.listeningScore).toBe(scaledSectionScore(90, 'LISTENING'))
      expect(r.readingScore).toBe(scaledSectionScore(80, 'READING'))
      expect(r.totalScore).toBe(r.listeningScore + r.readingScore)
      expect(r.parts).toHaveLength(7)
      expect(r.parts.reduce((s: number, p: { total: number }) => s + p.total, 0)).toBe(200)
      expect(r.parts.reduce((s: number, p: { correct: number }) => s + p.correct, 0)).toBe(170)
    })
  })

  describe('import-draft on production (cookie auth, no loopback)', () => {
    const draft = {
      exam: {
        code: 'PROD-IMPORT-RC',
        title: 'Prod import RC',
        durationSeconds: 600,
        parts: [{ partCode: 'PART_5', questionStart: 101, questionEnd: 101 }],
      },
      questions: [
        {
          number: 101,
          partCode: 'PART_5',
          type: 'MULTIPLE_CHOICE',
          prompt: 'Stem',
          options: [
            { key: 'A', text: 'a', correct: true },
            { key: 'B', text: 'b', correct: false },
          ],
        },
      ],
    }

    it('rejects anonymous import and accepts a logged-in admin', async () => {
      const prodApp = await createTestApp({}, { config: { isProd: true } })
      try {
        const denied = await client(prodApp).post('/exams/import-draft').send(draft)
        expect(denied.status).toBe(401)

        const { c } = await login(prodApp, ADMIN.username, ADMIN.password)
        await c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
        const authed = await c.post('/exams/import-draft').send(draft)
        expect(authed.status).toBe(400)
        expect(authed.body.error.message).toMatch(/Object storage is not configured/)
      } finally {
        await prodApp.close()
      }
    })
  })

  describe('focus watch', () => {
    const focus = (c: TestClient, id: string, state: 'away' | 'back') => c.post(`/attempts/${id}/focus`).send({ state })
    const rewindOpen = (id: string, msAgo: number) =>
      db
        .update(attemptFocusLeaves)
        .set({ leftAt: new Date(Date.now() - msAgo) })
        .where(and(eq(attemptFocusLeaves.attemptId, id), isNull(attemptFocusLeaves.returnedAt)))

    it('records tab leaves on a timed test, drops a flicker, and ignores practice', async () => {
      const examId = await publishedExam(SMALL_LAYOUT, { duration: 3600 })

      const practice = await student.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      expect(practice.body.focusWatch).toBe(false)
      const ignored = await focus(student, practice.body.id as string, 'away')
      expect(ignored.status).toBe(200)
      expect(ignored.body).toEqual({ recorded: false })
      const practiceResult = await student.post(`/attempts/${practice.body.id}/submit`)
      expect(practiceResult.status).toBe(200)
      expect(practiceResult.body.focus).toBeNull()

      const start = await student.post(`/exams/${examId}/attempts`).send({ mode: 'FULL_TEST' })
      expect(start.body.focusWatch).toBe(true)
      const id = start.body.id as string
      expect((await otherStudent.post(`/attempts/${id}/focus`).send({ state: 'away' })).status).toBe(404)

      expect((await focus(student, id, 'away')).body.recorded).toBe(true)
      await rewindOpen(id, 200)
      expect((await focus(student, id, 'back')).body.recorded).toBe(false)

      expect((await focus(student, id, 'away')).body.recorded).toBe(true)
      expect((await focus(student, id, 'away')).body.recorded).toBe(true)
      await rewindOpen(id, 5_000)
      expect((await focus(student, id, 'back')).body.recorded).toBe(true)

      expect((await focus(student, id, 'away')).body.recorded).toBe(true)
      await rewindOpen(id, 4_000)
      const submitted = await student.post(`/attempts/${id}/submit`)
      expect(submitted.status).toBe(200)
      expect(submitted.body.focus).toBeNull()
      expect((await student.get(`/attempts/${id}/result`)).body.focus).toBeNull()

      expect((await focus(student, id, 'away')).status).toBe(409)
      const staff = await admin.get(`/attempts/${id}/result`)
      expect(staff.status).toBe(200)
      expect(staff.body.focus.leaveCount).toBe(2)
      expect(staff.body.focus.awaySeconds).toBeGreaterThanOrEqual(9)
      expect(staff.body.focus.longestAwaySeconds).toBeGreaterThanOrEqual(4)
      expect(staff.body.focus.leaves).toHaveLength(2)
    })
  })

  it('hides an explanation until the sitting is submitted', async () => {
    const code = `EXPL-${++seq}-${Date.now()}`
    const imported = await admin.post('/exams/import-authored').send({
      code,
      title: 'Đề có lời giải',
      durationSeconds: 300,
      parts: [{ partCode: 'PART_5', questionStart: 101, questionEnd: 101 }],
      publish: true,
      groups: [],
      questions: [
        {
          partCode: 'PART_5',
          number: 101,
          prompt: 'The report was submitted _______ the deadline.',
          explanation: 'before là giới từ chỉ thời điểm.',
          options: [
            { key: 'A', text: 'before', correct: true },
            { key: 'B', text: 'previous', correct: false },
          ],
        },
      ],
    })
    expect(imported.status).toBe(201)
    const started = await student.post(`/exams/${imported.body.id}/attempts`).send({ mode: 'PRACTICE' })
    expect(started.status).toBe(200)
    const player = await student.get(`/attempts/${started.body.id}`)
    expect(JSON.stringify(player.body)).not.toContain('giới từ')
    const questionId = player.body.questions[0].id as string
    expect((await put(student, `/attempts/${started.body.id}/answers/${questionId}`, { selectedKey: 'A' })).status).toBe(200)
    expect((await student.post(`/attempts/${started.body.id}/submit`)).status).toBe(200)
    const review = await student.get(`/attempts/${started.body.id}/review`)
    expect(review.body.questions[0].explanation).toBe('before là giới từ chỉ thời điểm.')
  })
})
