import type { INestApplication } from '@nestjs/common'
import { rankFromXp, type StudentDashboardDto } from '@toeic/shared'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'
import { computeStreak } from './progress.service'

describe('rankFromXp', () => {
  it('climbs one rank every 100 EXP and stops at Thách Đấu', () => {
    expect(rankFromXp(0).label).toBe('Đồng III')
    expect(rankFromXp(99).label).toBe('Đồng III')
    expect(rankFromXp(100).label).toBe('Đồng II')
    expect(rankFromXp(200).label).toBe('Đồng I')
    expect(rankFromXp(300).label).toBe('Bạc III')
    expect(rankFromXp(2100).label).toBe('Thách Đấu')
    expect(rankFromXp(5000).label).toBe('Thách Đấu')
    expect(rankFromXp(5000).toNext).toBeNull()
    expect(rankFromXp(150).toNext).toBe(50)
  })
})

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-09-30', '2026-09-29', '2026-09-28'], '2026-09-30')).toEqual({ days: 3, activeToday: true })
  })
  it('keeps yesterday’s streak alive until today ends', () => {
    expect(computeStreak(['2026-09-29', '2026-09-28'], '2026-09-30')).toEqual({ days: 2, activeToday: false })
  })
  it('resets after a missed day', () => {
    expect(computeStreak(['2026-09-28', '2026-09-27'], '2026-09-30')).toEqual({ days: 0, activeToday: false })
    expect(computeStreak(['2026-09-30', '2026-09-28'], '2026-09-30')).toEqual({ days: 1, activeToday: true })
  })
  it('handles month and year boundaries and no activity', () => {
    expect(computeStreak(['2026-01-01', '2025-12-31', '2025-12-30'], '2026-01-01').days).toBe(3)
    expect(computeStreak([], '2026-09-30')).toEqual({ days: 0, activeToday: false })
  })
})

const SMALL = [
  { partCode: 'PART_5', questionStart: 101, questionEnd: 103 },
]
const FULL = [
  { partCode: 'PART_1', questionStart: 1, questionEnd: 6 },
  { partCode: 'PART_2', questionStart: 7, questionEnd: 31 },
  { partCode: 'PART_3', questionStart: 32, questionEnd: 70 },
  { partCode: 'PART_4', questionStart: 71, questionEnd: 100 },
  { partCode: 'PART_5', questionStart: 101, questionEnd: 130 },
  { partCode: 'PART_6', questionStart: 131, questionEnd: 146 },
  { partCode: 'PART_7', questionStart: 147, questionEnd: 200 },
]

describe('Student dashboard & goal (e2e on PGlite)', () => {
  let app: INestApplication
  let admin: TestClient
  let seq = 0
  const put = (c: TestClient, url: string, body: object) => c.agent.put(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)
  const patch = (c: TestClient, url: string, body: object) => c.agent.patch(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)

  async function newStudent(name: string, targetScore?: number): Promise<TestClient> {
    const created = await admin.post('/users/students').send({ fullName: name, ...(targetScore ? { targetScore } : {}) })
    const temp = created.body.temporaryPassword as string
    const { c } = await login(app, created.body.user.studentCode, temp)
    expect((await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'StudentPass99' })).status).toBe(200)
    return c
  }

  async function publishedExam(layout: typeof FULL) {
    const res = await admin.post('/exams').send({ code: `P-${++seq}-${Date.now()}`, title: `Progress exam ${seq}`, durationSeconds: 7200, parts: layout })
    const id = res.body.id as string
    const questions = layout.flatMap((p) =>
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

  /** Start PRACTICE on an exam and answer the first `n` questions ('A' = correct). Returns the attempt id. */
  async function practice(c: TestClient, examId: string, n: number, submit = false) {
    const start = await c.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
    const id = start.body.id as string
    const { questions } = (await c.get(`/attempts/${id}`)).body as { questions: Array<{ id: string }> }
    for (const q of questions.slice(0, n)) expect((await put(c, `/attempts/${id}/answers/${q.id}`, { selectedKey: 'A' })).status).toBe(200)
    if (submit) expect((await c.post(`/attempts/${id}/submit`)).status).toBe(200)
    return id
  }

  const dash = async (c: TestClient) => (await c.get('/me/dashboard')).body as StudentDashboardDto

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
    expect((await admin.get('/me/dashboard')).status).toBe(403)
    expect((await patch(admin, '/me/goal', { goal: { track: 'TWO_SKILL', score: 800 } })).status).toBe(403)
  })

  it('a brand-new account sees zeros and nulls — no sample data', async () => {
    const s = await newStudent('Tài Khoản Mới')
    const d = await dash(s)
    expect(d).toMatchObject({
      targetScore: null,
      goal: null,
      attemptsFinished: 0,
      latestScore: null,
      remainingToTarget: null,
      improvement: null,
      scoreHistory: [],
      streak: { days: 0, activeToday: false },
      honor: {
        enabled: true,
        className: 'Lớp K42',
        classBoard: { entries: [], you: null, participants: 0 },
      },
    })
    expect(d.skills.map((k) => [k.skill, k.attempts, k.answered, k.accuracy])).toEqual([
      ['LISTENING', 0, 0, null],
      ['READING', 0, 0, null],
    ])
    expect(d.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses the goal set by the teacher at creation and lets the student change or clear it', async () => {
    const s = await newStudent('Có Mục Tiêu', 850)
    expect((await dash(s)).targetScore).toBe(850)
    expect((await dash(s)).goal).toEqual({ track: 'TWO_SKILL', score: 850 })

    const changed = await patch(s, '/me/goal', { goal: { track: 'TWO_SKILL', score: 900 } })
    expect(changed.status).toBe(200)
    expect(changed.body.user).toMatchObject({ targetScore: 900, goal: { track: 'TWO_SKILL', score: 900 } })
    expect((await dash(s)).goal).toEqual({ track: 'TWO_SKILL', score: 900 })
    expect((await s.get('/auth/me')).body.user.goal).toEqual({ track: 'TWO_SKILL', score: 900 })

    const four = await patch(s, '/me/goal', { goal: { track: 'FOUR_SKILL', score: 1100 } })
    expect(four.status).toBe(200)
    expect(four.body.user.goal).toEqual({ track: 'FOUR_SKILL', score: 1100 })
    expect((await dash(s)).remainingToTarget).toBeNull()

    for (const bad of [
      { goal: { track: 'TWO_SKILL', score: 1000 } },
      { goal: { track: 'FOUR_SKILL', score: 2000 } },
      { goal: { track: 'TWO_SKILL', score: 5 } },
      { goal: { track: 'TWO_SKILL', score: 800.5 } },
      { goal: {} },
    ]) {
      expect((await patch(s, '/me/goal', bad)).status).toBe(400)
    }
    expect((await patch(s, '/me/goal', {})).status).toBe(400)

    const cleared = await patch(s, '/me/goal', { goal: null })
    expect(cleared.body.user.goal).toBeNull()
    expect(cleared.body.user.targetScore).toBeNull()
    expect((await dash(s)).targetScore).toBeNull()
  })

  it('lets a student update name, email and phone; student code stays fixed', async () => {
    const s = await newStudent('Tên Cũ')
    const other = await newStudent('Bạn Khác')
    await patch(other, '/me/profile', { fullName: 'Bạn Khác', email: 'taken@example.com', phone: '0900000001' })

    const ok = await patch(s, '/me/profile', { fullName: 'Nguyễn Văn Mới', email: 'moi@example.com', phone: '0912345678' })
    expect(ok.status).toBe(200)
    expect(ok.body.user).toMatchObject({ fullName: 'Nguyễn Văn Mới', email: 'moi@example.com', phone: '0912345678' })
    expect(ok.body.user.studentCode).toMatch(/^TM-/)
    expect((await s.get('/auth/me')).body.user.fullName).toBe('Nguyễn Văn Mới')

    const dup = await patch(s, '/me/profile', { fullName: 'Nguyễn Văn Mới', email: 'TAKEN@example.com', phone: '0912345678' })
    expect(dup.status).toBe(409)

    const cleared = await patch(s, '/me/profile', { fullName: 'Nguyễn Văn Mới', email: '', phone: '' })
    expect(cleared.status).toBe(200)
    expect(cleared.body.user.email).toBeNull()
    expect(cleared.body.user.phone).toBeNull()

    expect((await patch(s, '/me/profile', { fullName: 'x', email: '', phone: '' })).status).toBe(400)
    expect((await admin.agent.patch('/api/v1/me/profile').set('x-toeic-client', 'web').send({ fullName: 'Admin', email: '', phone: '' })).status).toBe(403)
  })

  it('practising starts a streak and puts the student on the weekly leaderboard', async () => {
    const examId = await publishedExam(SMALL as typeof FULL)
    const s = await newStudent('Chăm Chỉ')
    const id = await practice(s, examId, 2, true)
    expect(id).toBeTruthy()

    const d = await dash(s)
    expect(d.streak).toEqual({ days: 1, activeToday: true })
    expect(d.attemptsFinished).toBe(1)
    expect(d.latestScore).toBeNull() // partial practice has no 990-scale score
    expect(d.skills.find((k) => k.skill === 'READING')).toMatchObject({ attempts: 1, answered: 2, correct: 2, accuracy: 100 })
    expect(d.skills.find((k) => k.skill === 'LISTENING')).toMatchObject({ attempts: 0, accuracy: null })
    expect(d.honor.classBoard.you).toMatchObject({ name: 'Chăm Chỉ', weeklyXp: 10, you: true }) // 2 correct × 5 EXP
    expect(d.honor.me.rank.label).toBe('Đồng III')
    expect(d.honor.centerBoard.some((row) => row.name === 'Chăm Chỉ' && row.className === 'Lớp K42' && row.you)).toBe(true)
  })

  it('ranks classmates by weekly questions, limits to top 5, still shows you beyond the top, and shares only names', async () => {
    const examId = await publishedExam(SMALL as typeof FULL)
    const names = ['Hạng A', 'Hạng B', 'Hạng C', 'Hạng D', 'Hạng E', 'Hạng F']
    const clients: TestClient[] = []
    for (const [i, name] of names.entries()) {
      const c = await newStudent(name)
      clients.push(c)
      await practice(c, examId, 3 - Math.min(2, Math.floor(i / 2)), true) // 3,3,2,2,1,1 answered
    }
    const last = await dash(clients[5])
    // Previous tests' students are also in the class ranking, so assert structure rather than absolute ranks.
    expect(last.honor.classBoard.entries).toHaveLength(5)
    expect(last.honor.classBoard.entries.map((e) => e.place)).toEqual([1, 2, 3, 4, 5])
    expect(last.honor.classBoard.entries.every((e, i, arr) => i === 0 || arr[i - 1].weeklyXp >= e.weeklyXp)).toBe(true)
    expect(last.honor.classBoard.entries.every((e, i, arr) => i === 0 || arr[i - 1].yearlyXp >= e.yearlyXp)).toBe(true)
    expect(last.honor.classBoard.you).toMatchObject({ name: 'Hạng F', you: true })
    expect(last.honor.classBoard.you!.place).toBeGreaterThan(5)
    expect(last.honor.classBoard.participants).toBeGreaterThanOrEqual(7)
    for (const e of last.honor.classBoard.entries) expect(Object.keys(e).sort()).toEqual(['name', 'place', 'rank', 'weeklyXp', 'yearlyXp', 'you'])
    expect(last.honor.classBoard.entries.every((e) => e.rank.label.length > 0)).toBe(true)
    expect(last.honor.centerBoard.every((row) => row.className === 'Lớp K42' && row.name.length > 0)).toBe(true)

    const first = await dash(clients[0])
    expect(first.honor.classBoard.you!.place).toBeLessThan(last.honor.classBoard.you!.place)
    expect(last.honor.centerBoard.every((row, i, arr) => i === 0 || arr[i - 1].yearlyXp >= row.yearlyXp)).toBe(true)
  })

  it('ranks the center board by this year and drops last year’s EXP', async () => {
    const examId = await publishedExam(SMALL as typeof FULL)
    const early = await newStudent('Đầu Năm')
    const recent = await newStudent('Tuần Này')
    const lastYear = await newStudent('Năm Trước')
    const earlyId = await practice(early, examId, 3, true)
    const recentId = await practice(recent, examId, 1, true)
    const oldId = await practice(lastYear, examId, 3, true)

    const { attempts } = await import('../db/schema')
    const { DB } = await import('../db/database.module')
    const { eq, sql } = await import('drizzle-orm')
    const db = app.get<import('../db/database.module').Db>(DB)
    const bounds = (await db.execute(sql`
      select
        (date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh') as week_start,
        (date_trunc('year', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh') as year_start
    `)) as unknown as { rows: Array<{ week_start: Date; year_start: Date }> }
    const weekStart = new Date(bounds.rows[0]!.week_start)
    const yearStart = new Date(bounds.rows[0]!.year_start)
    await db.update(attempts).set({ submittedAt: yearStart }).where(eq(attempts.id, earlyId))
    await db.update(attempts).set({ submittedAt: new Date(yearStart.getTime() - 86_400_000) }).where(eq(attempts.id, oldId))

    const board = await dash(recent)
    const earlyRow = board.honor.centerBoard.find((row) => row.name === 'Đầu Năm')
    const recentRow = board.honor.centerBoard.find((row) => row.name === 'Tuần Này')
    expect(earlyRow).toMatchObject({ yearlyXp: 15, className: 'Lớp K42' })
    expect(recentRow).toMatchObject({ weeklyXp: 5, yearlyXp: 5 })
    expect(earlyRow!.place).toBeLessThan(recentRow!.place)
    expect(board.honor.centerBoard.some((row) => row.name === 'Năm Trước')).toBe(false)
    expect(board.honor.centerBoard.every((row, i, arr) => i === 0 || arr[i - 1].yearlyXp >= row.yearlyXp)).toBe(true)
    if (weekStart.getTime() > yearStart.getTime()) {
      expect(earlyRow!.weeklyXp).toBe(0)
      const earlyBoard = await dash(early)
      expect(earlyBoard.honor.classBoard.you).toMatchObject({ name: 'Đầu Năm', yearlyXp: 15, weeklyXp: 0 })
    }
    expect(recentId).toBeTruthy()
  })

  it('a full 200-question test produces the score history, latest score and distance to goal', async () => {
    const examId = await publishedExam(FULL)
    const s = await newStudent('Thi Thử Đủ', 850)

    const run = async (correctListening: number, correctReading: number) => {
      const start = await s.post(`/exams/${examId}/attempts`).send({ mode: 'FULL_TEST' })
      const id = start.body.id as string
      const { questions } = (await s.get(`/attempts/${id}`)).body as { questions: Array<{ id: string; number: number }> }
      for (const q of questions) {
        const inSection = q.number <= 100 ? q.number <= correctListening : q.number - 100 <= correctReading
        await put(s, `/attempts/${id}/answers/${q.id}`, { selectedKey: inSection ? 'A' : 'B' })
      }
      return (await s.post(`/attempts/${id}/submit`)).body as { totalScore: number; listeningScore: number; readingScore: number }
    }

    const first = await run(60, 50)
    const second = await run(80, 70)
    expect(second.totalScore).toBeGreaterThan(first.totalScore)

    const d = await dash(s)
    expect(d.attemptsFinished).toBe(2)
    expect(d.scoreHistory.map((p) => p.totalScore)).toEqual([first.totalScore, second.totalScore]) // oldest → newest
    expect(d.latestScore).toMatchObject({ totalScore: second.totalScore, listeningScore: second.listeningScore, readingScore: second.readingScore })
    expect(d.improvement).toBe(second.totalScore - first.totalScore)
    expect(d.remainingToTarget).toBe(Math.max(0, 850 - second.totalScore))
    expect(d.skills.find((k) => k.skill === 'LISTENING')).toMatchObject({ attempts: 2, answered: 200 })
  })

  it('rate-limits per account, not per IP: one noisy student cannot lock out a classmate on the same network', async () => {
    const noisy = await newStudent('Ồn Ào')
    const calm = await newStudent('Yên Tĩnh')
    let limited = 0
    for (let i = 0; i < 310; i++) if ((await noisy.get('/me/dashboard')).status === 429) limited++
    expect(limited).toBeGreaterThan(0)
    expect((await noisy.get('/me/dashboard')).status).toBe(429)
    expect((await calm.get('/me/dashboard')).status).toBe(200) // same IP, different account
  })

  describe('progress analytics & class report', () => {
    let teacher: TeacherClient
    type TeacherClient = TestClient

    beforeAll(async () => {
      const created = await admin.post('/users/staff').send({ username: 'teacher.prog', fullName: 'Thầy Tiến Độ', role: 'TEACHER' })
      expect(created.status).toBe(201)
      const temp = created.body.temporaryPassword as string
      const { c } = await login(app, 'teacher.prog', temp)
      expect((await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'TeacherPass99' })).status).toBe(200)
      teacher = c
      const rooms = await admin.get('/classes')
      const room = rooms.body[0] as { id: string; teachers: Array<{ id: string }> }
      const teacherIds = [...new Set([...(room.teachers ?? []).map((item) => item.id), created.body.user.id as string])]
      expect((await put(admin, `/classes/${room.id}/teachers`, { teacherIds })).status).toBe(200)
    })

    const progress = async (c: TestClient) => (await c.get('/me/progress')).body as import('@toeic/shared').StudentProgressDto

    it('new account: every enabled part listed with no data, no weakness declared', async () => {
      const s = await newStudent('Tiến Độ Mới')
      const p = await progress(s)
      expect(p.parts.map((x) => x.partCode)).toEqual(['PART_1', 'PART_2', 'PART_3', 'PART_4', 'PART_5', 'PART_6', 'PART_7', 'FILL_1'])
      expect(p.parts.every((x) => x.answered === 0 && x.accuracy === null && x.avgSeconds === null)).toBe(true)
      expect(p.weakestPart).toBeNull()
      expect(p.totals).toEqual({ attemptsFinished: 0, answered: 0, correct: 0, accuracy: null, avgSeconds: null })
      expect(p.recentAttempts).toEqual([])
      expect(p.lastActivityAt).toBeNull()
      expect(p.latestScore).toBeNull()
    })

    it('per-part accuracy, time per question, weakest part (only with enough data) and recent attempts', async () => {
      const layout = [
        { partCode: 'PART_5', questionStart: 101, questionEnd: 112 },
        { partCode: 'PART_7', questionStart: 147, questionEnd: 150 },
      ]
      const examId = await publishedExam(layout as typeof FULL)
      const s = await newStudent('Phân Tích Part')
      const start = await s.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      const id = start.body.id as string
      const { questions } = (await s.get(`/attempts/${id}`)).body as { questions: Array<{ id: string; number: number }> }
      for (const q of questions) {
        // Part 5: first 6 right, last 6 wrong (50%). Part 7: all 4 wrong — but only 4 answers, too few to call it a weakness.
        const right = q.number >= 101 && q.number <= 106
        expect((await put(s, `/attempts/${id}/answers/${q.id}`, { selectedKey: right ? 'A' : 'B', timeSpentSeconds: q.number <= 112 ? 20 : 60 })).status).toBe(200)
      }
      expect((await s.post(`/attempts/${id}/submit`)).status).toBe(200)

      const p = await progress(s)
      const p5 = p.parts.find((x) => x.partCode === 'PART_5')!
      const p7 = p.parts.find((x) => x.partCode === 'PART_7')!
      expect(p5).toMatchObject({ attempts: 1, answered: 12, correct: 6, accuracy: 50, avgSeconds: 20 })
      expect(p7).toMatchObject({ answered: 4, correct: 0, accuracy: 0, avgSeconds: 60 })
      expect(p.weakestPart?.partCode).toBe('PART_5') // Part 7 is 0% but has < 10 answers
      expect(p.totals).toMatchObject({ attemptsFinished: 1, answered: 16, correct: 6, accuracy: 38 })
      expect(p.totals.avgSeconds).toBe(30) // (12*20 + 4*60) / 16
      expect(p.recentAttempts).toHaveLength(1)
      expect(p.recentAttempts[0]).toMatchObject({ attemptId: id, correct: 6, total: 16, accuracy: 38, totalScore: null, status: 'SUBMITTED' })
      expect(p.lastActivityAt).toBeTruthy()
      expect(p.streak.days).toBe(1)
    })

    it('unfinished attempts do not count towards part accuracy', async () => {
      const examId = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 103 }] as typeof FULL)
      const s = await newStudent('Chưa Nộp')
      await practice(s, examId, 3, false)
      const p = await progress(s)
      expect(p.parts.find((x) => x.partCode === 'PART_5')).toMatchObject({ answered: 0, accuracy: null })
      expect(p.totals.attemptsFinished).toBe(0)
      expect(p.streak.days).toBe(1) // but the activity itself still counts for the streak
    })

    it('teachers and admins can read a student’s progress; students cannot; staff ids and unknown ids are 404', async () => {
      const s = await newStudent('Được Xem')
      const list = await admin.get('/users?role=STUDENT&q=Được')
      const sid = list.body.items.find((u: { fullName: string }) => u.fullName === 'Được Xem').id as string

      const asTeacher = await teacher.get(`/students/${sid}/progress`)
      expect(asTeacher.status).toBe(200)
      expect(asTeacher.body.parts).toHaveLength(8)
      expect((await admin.get(`/students/${sid}/progress`)).status).toBe(200)
      expect((await s.get(`/students/${sid}/progress`)).status).toBe(403)

      const me = (await admin.get('/auth/me')).body.user.id as string
      expect((await teacher.get(`/students/${me}/progress`)).status).toBe(404) // an admin account
      expect((await teacher.get('/students/3fa85f64-5717-4562-b3fc-2c963f66afa6/progress')).status).toBe(404)
      expect((await teacher.get('/students/not-a-uuid/progress')).status).toBe(400)
    })

    it('teachers can list a student’s finished attempts; students cannot hit the staff list', async () => {
      const examId = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 103 }] as typeof FULL)
      const s = await newStudent('Danh Sách Bài')
      const id = await practice(s, examId, 3, true)
      const found = await admin.get('/users?role=STUDENT&q=Danh%20Sách')
      const sid = found.body.items.find((u: { fullName: string }) => u.fullName === 'Danh Sách Bài').id as string
      const res = await teacher.get(`/students/${sid}/attempts`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0]).toMatchObject({ attemptId: id, status: 'SUBMITTED', assignmentTitle: null, partCodes: ['PART_5'] })
      expect((await s.get(`/students/${sid}/attempts`)).status).toBe(403)
    })

    it('exam report rolls finished sittings up by exam', async () => {
      const examId = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 103 }] as typeof FULL)
      const quiet = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 102 }] as typeof FULL)
      const pupil = await newStudent('Báo Cáo Đề')
      await practice(pupil, examId, 3, true)

      expect((await pupil.get('/reports/exams')).status).toBe(403)
      const res = await teacher.get('/reports/exams')
      expect(res.status).toBe(200)
      const body = res.body as import('@toeic/shared').ExamReportDto
      const row = body.exams.find((exam) => exam.id === examId)
      expect(row).toMatchObject({ attempts: 1, students: 1, accuracy: 100, correct: 3, answered: 3 })
      expect(row?.parts).toEqual([expect.objectContaining({ partCode: 'PART_5', correct: 3, answered: 3, accuracy: 100 })])
      expect(row?.weakestPart?.partCode).toBe('PART_5')
      expect(JSON.stringify(body)).not.toContain('Báo Cáo Đề')
      const empty = body.exams.find((exam) => exam.id === quiet)
      expect(empty).toMatchObject({ attempts: 0, students: 0, accuracy: null, parts: [] })
    })

    it('class report: staff only; counts, weekly activity, accuracy and inactive students', async () => {
      const examId = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 104 }] as typeof FULL)
      const pending = await admin.post('/users/students').send({ fullName: 'Chưa Đăng Nhập' }) // never changed the temp password
      expect(pending.status).toBe(201)
      const idle = await newStudent('Im Lặng') // logged in, never practised
      const busy = await newStudent('Siêng Năng')
      await practice(busy, examId, 4, true)

      expect((await idle.get('/reports/class')).status).toBe(403)
      const res = await teacher.get('/reports/class')
      expect(res.status).toBe(200)
      const r = res.body as import('@toeic/shared').ClassReportDto
      expect(r.students.pendingFirstLogin).toBeGreaterThanOrEqual(1)
      expect(r.students.total).toBeGreaterThanOrEqual(r.students.active)
      expect(r.week.activeStudents).toBeGreaterThanOrEqual(1)
      expect(r.week.answered).toBeGreaterThanOrEqual(4)
      expect(r.accuracy30d).not.toBeNull()

      const names = r.inactive.map((i) => i.fullName)
      expect(names).toContain('Im Lặng')
      expect(names).not.toContain('Siêng Năng') // practised today
      expect(names).not.toContain('Chưa Đăng Nhập') // tracked separately as pendingFirstLogin
      expect(r.inactive.find((i) => i.fullName === 'Im Lặng')).toMatchObject({ daysInactive: null, lastActivityAt: null })
      expect(r.inactiveCount).toBeGreaterThanOrEqual(r.inactive.length)
    })

    it('a student whose last activity is over 7 days old is reported with the number of idle days', async () => {
      const examId = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 102 }] as typeof FULL)
      const s = await newStudent('Bỏ Bê')
      const id = await practice(s, examId, 2, true)
      const { attemptAnswers } = await import('../db/schema')
      const { DB } = await import('../db/database.module')
      const { eq } = await import('drizzle-orm')
      const db = app.get<import('../db/database.module').Db>(DB)
      await db.update(attemptAnswers).set({ answeredAt: new Date(Date.now() - 10 * 86_400_000) }).where(eq(attemptAnswers.attemptId, id))

      const r = (await teacher.get('/reports/class')).body as import('@toeic/shared').ClassReportDto
      expect(r.inactive.find((i) => i.fullName === 'Bỏ Bê')).toMatchObject({ daysInactive: 10, reasons: expect.arrayContaining(['INACTIVE']) })
      // and it is no longer a streak
      expect((await dash(s)).streak).toEqual({ days: 0, activeToday: false })
    })

    it('flags students under 50% accuracy and students who missed a homework deadline', async () => {
      const examId = await publishedExam([{ partCode: 'PART_5', questionStart: 101, questionEnd: 104 }] as typeof FULL)
      const weakCreated = await admin.post('/users/students').send({ fullName: 'Yếu Bài' })
      expect(weakCreated.status).toBe(201)
      const weak = (await login(app, weakCreated.body.user.studentCode as string, weakCreated.body.temporaryPassword as string)).c
      expect((await weak.post('/auth/change-password').send({ currentPassword: weakCreated.body.temporaryPassword, newPassword: 'StudentPass99' })).status).toBe(200)
      const start = await weak.post(`/exams/${examId}/attempts`).send({ mode: 'PRACTICE' })
      const attemptId = start.body.id as string
      const { questions } = (await weak.get(`/attempts/${attemptId}`)).body as { questions: Array<{ id: string }> }
      for (const q of questions) expect((await put(weak, `/attempts/${attemptId}/answers/${q.id}`, { selectedKey: 'B' })).status).toBe(200)
      expect((await weak.post(`/attempts/${attemptId}/submit`)).status).toBe(200)

      const low = ((await teacher.get('/reports/class')).body as import('@toeic/shared').ClassReportDto).inactive.find((i) => i.fullName === 'Yếu Bài')
      expect(low).toMatchObject({ accuracy: 0, reasons: ['LOW_ACCURACY'] })

      const lateCreated = await admin.post('/users/students').send({ fullName: 'Quá Hạn Bài' })
      const lateId = lateCreated.body.user.id as string
      const late = (await login(app, lateCreated.body.user.studentCode as string, lateCreated.body.temporaryPassword as string)).c
      expect((await late.post('/auth/change-password').send({ currentPassword: lateCreated.body.temporaryPassword, newPassword: 'StudentPass99' })).status).toBe(200)
      await practice(late, examId, 4, true)
      const assigned = await admin.post('/assignments').send({
        title: 'Bài quá hạn cần hỗ trợ',
        examId,
        partCodes: ['PART_5'],
        durationSeconds: 300,
        dueAt: new Date(Date.now() - 60_000).toISOString(),
        studentIds: [lateId],
      })
      expect(assigned.status).toBe(201)

      const missed = ((await teacher.get('/reports/class')).body as import('@toeic/shared').ClassReportDto).inactive.find((i) => i.fullName === 'Quá Hạn Bài')
      expect(missed?.reasons).toContain('OVERDUE')
      expect(missed?.overdueCount).toBeGreaterThanOrEqual(1)
      expect(missed?.reasons).not.toContain('LOW_ACCURACY')
    })

    it('shows a teacher only the classes they manage, and an admin every class board', async () => {
      const examId = await publishedExam(SMALL as typeof FULL)
      const home = await admin.post('/users/students').send({ fullName: 'Hạng K42' })
      expect(home.status).toBe(201)
      const homePupil = (await login(app, home.body.user.studentCode as string, home.body.temporaryPassword as string)).c
      expect((await homePupil.post('/auth/change-password').send({ currentPassword: home.body.temporaryPassword, newPassword: 'StudentPass99' })).status).toBe(200)
      await practice(homePupil, examId, 2, true)

      const created = await admin.post('/users/students').send({ fullName: 'Hạng Riêng' })
      expect(created.status).toBe(201)
      const room = await admin.post('/classes').send({ name: 'Lớp Giáo Viên A' })
      expect(room.status).toBe(201)
      expect((await put(admin, '/classes/members', { userId: created.body.user.id, classId: room.body.id })).status).toBe(200)
      const pupil = (await login(app, created.body.user.studentCode as string, created.body.temporaryPassword as string)).c
      expect((await pupil.post('/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'StudentPass99' })).status).toBe(200)
      await practice(pupil, examId, 3, true)

      const staff = await admin.post('/users/staff').send({ username: 'teacher.honor', fullName: 'Thầy Hạng', role: 'TEACHER' })
      expect(staff.status).toBe(201)
      const narrow = (await login(app, 'teacher.honor', staff.body.temporaryPassword as string)).c
      expect((await narrow.post('/auth/change-password').send({ currentPassword: staff.body.temporaryPassword, newPassword: 'TeacherPass99' })).status).toBe(200)
      expect((await put(admin, `/classes/${room.body.id}/teachers`, { teacherIds: [staff.body.user.id] })).status).toBe(200)

      const mine = (await narrow.get('/reports/honor')).body as import('@toeic/shared').StaffHonorDto
      expect(mine.enabled).toBe(true)
      expect(mine.classes.map((row) => row.className)).toEqual(['Lớp Giáo Viên A'])
      expect(mine.classes[0]?.entries.map((row) => row.name)).toEqual(['Hạng Riêng'])
      expect(JSON.stringify(mine.classes)).not.toContain('Chăm Chỉ')
      expect(mine.centerBoard.map((row) => row.name)).toEqual(expect.arrayContaining(['Hạng Riêng', 'Hạng K42']))
      expect(mine.centerBoard.find((row) => row.name === 'Hạng Riêng')).toMatchObject({ className: 'Lớp Giáo Viên A', yours: true })
      expect(mine.centerBoard.find((row) => row.name === 'Hạng K42')?.yours).toBe(false)

      const k42 = (await teacher.get('/reports/honor')).body as import('@toeic/shared').StaffHonorDto
      expect(k42.classes.map((row) => row.className)).toEqual(['Lớp K42'])
      expect(k42.classes[0]?.entries.map((row) => row.name)).toContain('Hạng K42')
      expect(k42.classes[0]?.entries.map((row) => row.name)).not.toContain('Hạng Riêng')
      expect(k42.centerBoard.some((row) => row.name === 'Hạng Riêng' && row.className === 'Lớp Giáo Viên A')).toBe(true)

      const all = (await admin.get('/reports/honor')).body as import('@toeic/shared').StaffHonorDto
      expect(all.classes.map((row) => row.className)).toEqual(expect.arrayContaining(['Lớp K42', 'Lớp Giáo Viên A']))
      expect(all.classes.find((row) => row.className === 'Lớp Giáo Viên A')?.entries.map((row) => row.name)).toEqual(['Hạng Riêng'])
      expect((await pupil.get('/reports/honor')).status).toBe(403)
    })
  })

  it('keeps each class off the other class roster and can hide the whole board', async () => {
    const examId = await publishedExam(SMALL as typeof FULL)
    const createdA = await admin.post('/users/students').send({ fullName: 'Lớp A Một' })
    const createdB = await admin.post('/users/students').send({ fullName: 'Lớp B Hai' })
    const room = await admin.post('/classes').send({ name: 'Lớp Bí Mật' })
    expect(room.status).toBe(201)
    expect((await put(admin, '/classes/members', { userId: createdB.body.user.id, classId: room.body.id })).status).toBe(200)

    const loginStudent = async (created: { body: { user: { studentCode: string }; temporaryPassword: string } }) => {
      const { c } = await login(app, created.body.user.studentCode, created.body.temporaryPassword)
      await c.post('/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'StudentPass99' })
      return c
    }
    const a = await loginStudent(createdA)
    const b = await loginStudent(createdB)
    await practice(a, examId, 3, true)
    await practice(b, examId, 3, true)

    const boardA = await dash(a)
    const boardB = await dash(b)
    expect(boardA.honor.className).toBe('Lớp K42')
    expect(boardB.honor.className).toBe('Lớp Bí Mật')
    expect(boardA.honor.classBoard.entries.map((e) => e.name)).not.toContain('Lớp B Hai')
    expect(boardB.honor.classBoard.entries.map((e) => e.name)).toEqual(['Lớp B Hai'])
    expect(boardA.honor.centerBoard.map((row) => row.name)).toEqual(expect.arrayContaining(['Lớp A Một', 'Lớp B Hai']))
    expect(boardA.honor.centerBoard.find((row) => row.name === 'Lớp B Hai')?.className).toBe('Lớp Bí Mật')
    expect(boardB.honor.centerBoard.find((row) => row.name === 'Lớp B Hai')?.you).toBe(true)

    expect((await put(admin, '/site-settings', { honorBoardEnabled: false })).status).toBe(200)
    const hidden = await dash(a)
    expect(hidden.honor.enabled).toBe(false)
    expect(hidden.honor.classBoard.entries).toEqual([])
    expect(hidden.honor.centerBoard).toEqual([])
    expect((await put(admin, '/site-settings', { honorBoardEnabled: true })).status).toBe(200)
  })

  it('lets an admin restart one class board without clearing the yearly center board', async () => {
    const examId = await publishedExam(SMALL as typeof FULL)
    const created = await admin.post('/users/students').send({ fullName: 'Reset Riêng' })
    expect(created.status).toBe(201)
    const room = await admin.post('/classes').send({ name: `Lớp Reset ${seq}` })
    expect(room.status).toBe(201)
    expect((await put(admin, '/classes/members', { userId: created.body.user.id, classId: room.body.id })).status).toBe(200)
    const pupil = (await login(app, created.body.user.studentCode as string, created.body.temporaryPassword as string)).c
    expect((await pupil.post('/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'StudentPass99' })).status).toBe(200)
    await practice(pupil, examId, 3, true)

    const before = await dash(pupil)
    expect(before.honor.classBoard.you).toMatchObject({ name: 'Reset Riêng', yearlyXp: 15 })
    expect(before.honor.centerBoard.find((row) => row.name === 'Reset Riêng')).toMatchObject({ yearlyXp: 15, className: room.body.name })

    expect((await pupil.post(`/classes/${room.body.id}/honor-reset`)).status).toBe(403)
    const username = `teacher.reset.${seq}`
    const staff = await admin.post('/users/staff').send({ username, fullName: 'Thầy Reset', role: 'TEACHER' })
    expect(staff.status).toBe(201)
    const teacher = (await login(app, username, staff.body.temporaryPassword as string)).c
    expect((await teacher.post('/auth/change-password').send({ currentPassword: staff.body.temporaryPassword, newPassword: 'TeacherPass99' })).status).toBe(200)
    expect((await teacher.post(`/classes/${room.body.id}/honor-reset`)).status).toBe(403)

    const reset = await admin.post(`/classes/${room.body.id}/honor-reset`)
    expect(reset.status).toBe(201)
    expect(typeof reset.body.resetAt).toBe('string')

    const cleared = await dash(pupil)
    expect(cleared.honor.classBoard.resetAt).toBe(reset.body.resetAt)
    expect(cleared.honor.classBoard.you).toBeNull()
    expect(cleared.honor.me.yearlyXp).toBe(15)
    expect(cleared.honor.centerBoard.find((row) => row.name === 'Reset Riêng')).toMatchObject({ yearlyXp: 15 })

    await practice(pupil, examId, 1, true)
    const again = await dash(pupil)
    expect(again.honor.classBoard.you).toMatchObject({ yearlyXp: 5 })
    expect(again.honor.centerBoard.find((row) => row.name === 'Reset Riêng')).toMatchObject({ yearlyXp: 20 })

    const staffBoard = (await admin.get('/reports/honor')).body as import('@toeic/shared').StaffHonorDto
    const listed = staffBoard.classes.find((row) => row.classId === room.body.id)
    expect(listed?.resetAt).toBe(reset.body.resetAt)
    expect(listed?.entries.map((row) => row.name)).toEqual(['Reset Riêng'])
    expect((await admin.post('/classes/00000000-0000-4000-8000-000000000099/honor-reset')).status).toBe(404)
  })

  it('closes a class to new students and deletes the class without deleting accounts', async () => {
    const created = await admin.post('/users/students').send({ fullName: 'Học Viên Giữ Lại' })
    expect(created.status).toBe(201)
    const extra = await admin.post('/users/students').send({ fullName: 'Học Viên Muộn' })
    expect(extra.status).toBe(201)
    const room = await admin.post('/classes').send({ name: `Lớp Đóng ${seq}` })
    expect(room.status).toBe(201)
    expect(room.body.closedAt).toBeNull()
    expect((await put(admin, '/classes/members', { userId: created.body.user.id, classId: room.body.id })).status).toBe(200)

    const pupil = (await login(app, created.body.user.studentCode as string, created.body.temporaryPassword as string)).c
    expect((await pupil.post(`/classes/${room.body.id}/close`).send({ closed: true })).status).toBe(403)

    const closed = await admin.post(`/classes/${room.body.id}/close`).send({ closed: true })
    expect(closed.status).toBe(201)
    expect(typeof closed.body.closedAt).toBe('string')
    expect((await put(admin, '/classes/members', { userId: extra.body.user.id, classId: room.body.id })).status).toBe(409)

    const hidden = (await admin.get('/reports/honor')).body as import('@toeic/shared').StaffHonorDto
    expect(hidden.classes.some((row) => row.classId === room.body.id)).toBe(false)

    const reopened = await admin.post(`/classes/${room.body.id}/close`).send({ closed: false })
    expect(reopened.status).toBe(201)
    expect(reopened.body.closedAt).toBeNull()

    const gone = await admin.agent.delete(`/api/v1/classes/${room.body.id}`).set('x-toeic-client', 'web')
    expect(gone.status).toBe(200)
    const still = await admin.get(`/users/${created.body.user.id}`)
    expect(still.status).toBe(200)
    expect(still.body.id).toBe(created.body.user.id)
    const rooms = await admin.get('/classes')
    expect((rooms.body as Array<{ id: string }>).some((row) => row.id === room.body.id)).toBe(false)
  })

  it('never exposes another student’s data: the dashboard is computed only for the caller', async () => {
    const a = await newStudent('Riêng Tư A', 700)
    const b = await newStudent('Riêng Tư B', 950)
    expect((await dash(a)).targetScore).toBe(700)
    expect((await dash(b)).targetScore).toBe(950)
  })
})
