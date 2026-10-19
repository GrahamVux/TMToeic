import type { INestApplication } from '@nestjs/common'
import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES } from '@toeic/shared'
import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { DB, type Db } from '../db/database.module'
import { attempts } from '../db/schema'
import { ADMIN, client, createTestApp, login, type TestClient } from '../test/test-app'

const P5 = [{ partCode: 'PART_5', questionStart: 1, questionEnd: 3 }]

function authored(code: string) {
  return {
    code,
    title: `Homework ${code}`,
    durationSeconds: 600,
    parts: P5,
    publish: true,
    groups: [],
    questions: P5.flatMap((p) =>
      Array.from({ length: p.questionEnd - p.questionStart + 1 }, (_, i) => {
        const number = p.questionStart + i
        return {
          partCode: p.partCode,
          number,
          prompt: `Q${number}`,
          options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `${key}${number}`, correct: key === 'A' })),
        }
      }),
    ),
  }
}

describe('Assignments (e2e)', () => {
  let app: INestApplication
  let db: Db
  let admin: TestClient
  let student: TestClient
  let studentId: string
  let other: TestClient
  let seq = 0

  async function newStudent(name: string): Promise<{ c: TestClient; id: string }> {
    const created = await admin.post('/users/students').send({ fullName: name })
    const id = created.body.user.id as string
    const code = created.body.user.studentCode as string
    const temp = created.body.temporaryPassword as string
    const { c } = await login(app, code, temp)
    expect((await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'StudentPass99' })).status).toBe(200)
    return { c, id }
  }

  beforeAll(async () => {
    app = await createTestApp()
    db = app.get(DB)
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
    const s1 = await newStudent('Học viên A')
    student = s1.c
    studentId = s1.id
    const s2 = await newStudent('Học viên B')
    other = s2.c
  })

  afterAll(() => app.close())

  it('imports an authored exam into the bank, assigns selected parts, student can sit it', async () => {
    const code = `GV-ASG-${++seq}-${Date.now()}`
    const imported = await admin.post('/exams/import-authored').send(authored(code))
    expect(imported.status).toBe(201)
    expect(imported.body.status).toBe('PUBLISHED')
    expect(imported.body.parts.map((p: { code: string }) => p.code)).toEqual(['PART_5'])

    const due = new Date(Date.now() + 86_400_000).toISOString()
    const created = await admin.post('/assignments').send({
      title: 'Part 5 tuần này',
      examId: imported.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 300,
      dueAt: due,
      studentIds: [studentId],
      publish: true,
    })
    expect(created.status).toBe(201)
    expect(created.body.studentCount).toBe(1)
    expect(created.body.parts[0].questionCount).toBe(3)

    const mine = await student.get('/assignments')
    expect(mine.status).toBe(200)
    const row = (mine.body as Array<{ title: string; id: string }>).find((x) => x.title === 'Part 5 tuần này')
    expect(row).toBeTruthy()

    const start = await student.post(`/assignments/${created.body.id}/start`).send({})
    expect(start.status).toBe(200)
    expect(start.body.assignmentId).toBe(created.body.id)
    expect(start.body.totalQuestions).toBe(3)

    const resume = await student.post(`/assignments/${created.body.id}/start`).send({})
    expect(resume.status).toBe(200)
    expect(resume.body.id).toBe(start.body.id)

    const blocked = await other.post(`/assignments/${created.body.id}/start`).send({})
    expect(blocked.status).toBe(403)

    const listAdmin = await admin.get(`/assignments/${created.body.id}`)
    expect(listAdmin.status).toBe(200)
    expect(listAdmin.body.students).toHaveLength(1)
    expect(listAdmin.body.students[0]).toMatchObject({
      studentId,
      status: 'IN_PROGRESS',
      correctCount: null,
      totalScore: null,
    })

    const player = await student.get(`/attempts/${start.body.id}`)
    expect(player.status).toBe(200)
    const qs = player.body.questions as Array<{ id: string }>
    expect(qs).toHaveLength(3)
    for (const q of qs) {
      const saved = await student.agent
        .put(`/api/v1/attempts/${start.body.id}/answers/${q.id}`)
        .set(CSRF_HEADER, CSRF_HEADER_VALUE)
        .send({ selectedKey: 'A' })
      expect(saved.status).toBe(200)
    }
    expect((await student.post(`/attempts/${start.body.id}/submit`)).status).toBe(200)

    const scored = await admin.get(`/assignments/${created.body.id}`)
    expect(scored.body.students[0]).toMatchObject({
      studentId,
      status: 'COMPLETED',
      correctCount: 3,
      totalQuestions: 3,
      totalScore: null,
    })
    expect(scored.body.submittedCount).toBe(1)
  })

  it('rejects assigning unpublished exams and unknown parts', async () => {
    const draft = await admin.post('/exams').send({
      code: `GV-DRAFT-${++seq}-${Date.now()}`,
      title: 'Draft only',
      durationSeconds: 600,
      parts: P5,
    })
    expect(draft.status).toBe(201)
    const res = await admin.post('/assignments').send({
      title: 'Không được giao',
      examId: draft.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 300,
    })
    expect(res.status).toBe(400)

    const code = `GV-ASG-${++seq}-${Date.now()}`
    const imported = await admin.post('/exams/import-authored').send(authored(code))
    const badPart = await admin.post('/assignments').send({
      title: 'Sai part',
      examId: imported.body.id,
      partCodes: ['PART_1'],
      durationSeconds: 300,
    })
    expect(badPart.status).toBe(400)
  })

  it('does not let a student start after due date', async () => {
    const code = `GV-ASG-${++seq}-${Date.now()}`
    const imported = await admin.post('/exams/import-authored').send(authored(code))
    const created = await admin.post('/assignments').send({
      title: 'Hết hạn',
      examId: imported.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 300,
      dueAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(created.status).toBe(201)
    const start = await student.post(`/assignments/${created.body.id}/start`).send({})
    expect(start.status).toBe(403)
    expect(start.body.error.code).toBe(ERROR_CODES.FORBIDDEN)
  })

  it('scores a sitting as soon as the clock runs out, even if the student never submits', async () => {
    const code = `GV-ASG-${++seq}-${Date.now()}`
    const imported = await admin.post('/exams/import-authored').send(authored(code))
    const created = await admin.post('/assignments').send({
      title: 'Hết giờ vẫn có điểm',
      examId: imported.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 600,
      studentIds: [studentId],
    })
    expect(created.status).toBe(201)
    const start = await student.post(`/assignments/${created.body.id}/start`).send({})
    expect(start.status).toBe(200)
    await db.update(attempts).set({ deadlineAt: new Date(Date.now() - 60_000) }).where(eq(attempts.id, start.body.id as string))

    const detail = await admin.get(`/assignments/${created.body.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.students[0]).toMatchObject({ status: 'COMPLETED', correctCount: 0, totalQuestions: 3 })
    expect(detail.body.submittedCount).toBe(1)
  })

  async function sit(c: TestClient, assignmentId: string, keyFor: (n: number) => string) {
    const start = await c.post(`/assignments/${assignmentId}/start`).send({})
    expect(start.status).toBe(200)
    const player = await c.get(`/attempts/${start.body.id}`)
    const qs = player.body.questions as Array<{ id: string; number: number }>
    for (const q of qs) {
      const saved = await c.agent
        .put(`/api/v1/attempts/${start.body.id}/answers/${q.id}`)
        .set(CSRF_HEADER, CSRF_HEADER_VALUE)
        .send({ selectedKey: keyFor(q.number) })
      expect(saved.status).toBe(200)
    }
    expect((await c.post(`/attempts/${start.body.id}/submit`)).status).toBe(200)
  }

  it('exports the class workbook only after every student finishes a full paper', async () => {
    const code = `GV-ASG-${++seq}-${Date.now()}`
    const imported = await admin.post('/exams/import-authored').send(authored(code))
    const hoa = await newStudent('Hoa')
    const lan = await newStudent('Lan')
    const created = await admin.post('/assignments').send({
      title: 'Bo de chot',
      examId: imported.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 600,
      studentIds: [studentId, hoa.id, lan.id],
    })
    expect(created.status).toBe(201)
    expect(created.body.wholeExam).toBe(true)
    const id = created.body.id as string

    const early = await admin.get(`/assignments/${id}/report`)
    expect(early.status).toBe(409)
    expect(early.body.error.message).toContain('chưa hoàn thành')
    expect((await student.get(`/assignments/${id}/report`)).status).toBe(403)

    await sit(student, id, (n) => (n === 1 ? 'B' : 'A'))
    expect((await admin.get(`/assignments/${id}/report`)).status).toBe(409)
    await sit(hoa.c, id, () => 'B')
    await sit(lan.c, id, () => 'B')

    const res = await admin
      .get(`/assignments/${id}/report`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => callback(null, Buffer.concat(chunks)))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain('ket-qua-bo-de-chot.xlsx')

    const book = new ExcelJS.Workbook()
    await book.xlsx.load(res.body)
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(
      expect.arrayContaining(['Tổng Hợp Lớp', 'Câu Sai Chung (>2 Bạn)', 'Học viên A', 'Hoa', 'Lan', 'Thang Điểm ETS']),
    )
    const summary = book.getWorksheet('Tổng Hợp Lớp')
    expect(summary?.getCell(4, 1).value).toBe('Học viên')
    expect(summary?.getCell(4, 2).value).toBe('Part 5 (3c)')
    const wrong = book.getWorksheet('Câu Sai Chung (>2 Bạn)')
    const wrongNumbers = wrong?.getColumn(1).values.map((value) => String(value ?? '')) ?? []
    expect(wrongNumbers).toContain('1')
    expect(wrongNumbers).not.toContain('2')
    const detail = book.getWorksheet('Hoa')
    expect(String(detail?.getCell(1, 1).value)).toContain('Hoa')
  })

  it('refuses the workbook when the assignment is only part of the exam', async () => {
    const code = `GV-ASG-${++seq}-${Date.now()}`
    const parts = [
      { partCode: 'PART_5', questionStart: 1, questionEnd: 2 },
      { partCode: 'PART_6', questionStart: 3, questionEnd: 4 },
    ]
    const imported = await admin.post('/exams/import-authored').send({
      ...authored(code),
      parts,
      questions: parts.flatMap((p) =>
        Array.from({ length: p.questionEnd - p.questionStart + 1 }, (_, i) => {
          const number = p.questionStart + i
          return {
            partCode: p.partCode,
            number,
            prompt: `Q${number}`,
            options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `${key}${number}`, correct: key === 'A' })),
          }
        }),
      ),
    })
    expect(imported.status).toBe(201)
    const created = await admin.post('/assignments').send({
      title: 'Chi part 5',
      examId: imported.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 300,
      studentIds: [studentId],
    })
    expect(created.body.wholeExam).toBe(false)
    await sit(student, created.body.id as string, () => 'A')
    const res = await admin.get(`/assignments/${created.body.id}/report`)
    expect(res.status).toBe(409)
    expect(res.body.error.message).toContain('cả bộ đề')
  })
})

describe('Assignment audio and sheet images', () => {
  let app: INestApplication
  let admin: TestClient
  let student: TestClient
  let studentId: string
  const storage = {
    enabled: true,
    bucket: 'toeic-content',
    signedGetUrl: (key: string) => Promise.resolve(`https://r2.test/${key}?sig=fake`),
    putObject: () => Promise.resolve(),
  }

  beforeAll(async () => {
    app = await createTestApp({}, { storage })
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
    const created = await admin.post('/users/students').send({ fullName: 'Nghe Bài Tập' })
    studentId = created.body.user.id as string
    const { c } = await login(app, created.body.user.studentCode as string, created.body.temporaryPassword as string)
    await c.post('/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'StudentPass99' })
    student = c
  })
  afterAll(() => app.close())

  function postRaw(id: string, kind: 'audio/file' | 'images', type: string, name: string, body: Buffer) {
    return admin.agent
      .post(`/api/v1/assignments/${id}/${kind}?filename=${encodeURIComponent(name)}`)
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .set('content-type', type)
      .send(body)
  }

  it('attaches a listening file and exam photos that the student hears and sees', async () => {
    const exam = await admin.post('/exams/import-authored').send({
      code: `GV-MEDIA-${Date.now()}`,
      title: 'Part 2 có file',
      durationSeconds: 600,
      publish: true,
      parts: [{ partCode: 'PART_2', questionStart: 1, questionEnd: 1 }],
      groups: [],
      questions: [
        {
          partCode: 'PART_2',
          number: 1,
          prompt: 'Where?',
          options: ['A', 'B', 'C'].map((key) => ({ key, text: key, correct: key === 'A' })),
        },
      ],
    })
    expect(exam.status).toBe(201)
    const created = await admin.post('/assignments').send({
      title: 'Nghe Part 2',
      examId: exam.body.id,
      partCodes: ['PART_2'],
      durationSeconds: 300,
      studentIds: [],
    })
    // empty studentIds means the whole class, including the student created above
    expect(created.status).toBe(201)

    const reading = await admin.post('/exams/import-authored').send(authored(`GV-RC-${Date.now()}`))
    const readingAsg = await admin.post('/assignments').send({
      title: 'Đọc',
      examId: reading.body.id,
      partCodes: ['PART_5'],
      durationSeconds: 300,
    })
    expect((await postRaw(readingAsg.body.id, 'audio/file', 'audio/mpeg', 'x.mp3', Buffer.from('ID3'))).status).toBe(400)

    expect((await postRaw(created.body.id, 'audio/file', 'application/pdf', 'x.pdf', Buffer.from('%PDF'))).status).toBe(400)
    expect((await postRaw(created.body.id, 'audio/file', 'audio/mpeg', 'clip.mp3', Buffer.from('ID3-fake'))).status).toBe(200)
    expect((await postRaw(created.body.id, 'images', 'image/jpeg', 'trang-1.jpg', Buffer.from('jpeg'))).status).toBe(200)
    expect((await admin.get('/assignments')).body.find((a: { id: string }) => a.id === created.body.id)).toMatchObject({ hasAudio: true, imageCount: 1 })

    const started = await student.post(`/assignments/${created.body.id}/start`).send({})
    expect(started.status).toBe(200)
    const player = await student.get(`/attempts/${started.body.id}`)
    expect(player.body.audio).toHaveLength(1)
    expect(player.body.audio[0].partCodes).toEqual(['PART_2'])
    expect(player.body.audio[0].url).toMatch(/^https:\/\/r2\.test\/assignments\//)
    expect(player.body.sheetImages).toHaveLength(1)
    expect(player.body.sheetImages[0].url).toMatch(/images\//)
    expect(JSON.stringify(player.body)).not.toMatch(/objectKey|"bucket"/)
  })

  it('assigns a fill-in exercise, scores typed answers, then saves it into the bank', async () => {
    const created = await admin.post('/assignments/fill').send({
      title: 'Điền từ tuần kiểm tra',
      durationSeconds: 600,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      studentIds: [studentId],
      items: [
        { prompt: 'The train was ___ late.', answers: ['very | extremely'] },
        { prompt: 'Please ___ the form and ___ it today.', answers: ['complete', 'submit | send'] },
      ],
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ fillBlank: true, inBank: false, wholeExam: false, partCodes: ['FILL_1'] })

    const hidden = await admin.get('/exams')
    expect((hidden.body as Array<{ id: string }>).some((exam) => exam.id === created.body.examId)).toBe(false)

    const started = await student.post(`/assignments/${created.body.id}/start`).send({})
    expect(started.status).toBe(200)
    const player = await student.get(`/attempts/${started.body.id}`)
    const questions = player.body.questions as Array<{ id: string; prompt: string; options: unknown[]; blankIndex: number; answerText: string | null }>
    expect(questions).toHaveLength(3)
    expect(questions[0]).toMatchObject({ prompt: 'The train was ___ late.', options: [], blankIndex: 0, answerText: null })
    expect(questions[1].blankIndex).toBe(0)
    expect(questions[2].blankIndex).toBe(1)
    expect(JSON.stringify(player.body)).not.toMatch(/extremely|complete|send/)

    const putAnswer = (questionId: string, answerText: string) =>
      student.agent.put(`/api/v1/attempts/${started.body.id}/answers/${questionId}`).set(CSRF_HEADER, CSRF_HEADER_VALUE).send({ answerText })
    expect((await putAnswer(questions[0].id, 'Very')).status).toBe(200)
    expect((await putAnswer(questions[1].id, 'finish')).status).toBe(200)
    expect((await putAnswer(questions[2].id, 'submit')).status).toBe(200)

    const result = await student.post(`/attempts/${started.body.id}/submit`).send({})
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ correctCount: 2, incorrectCount: 1, unansweredCount: 0 })

    const review = await student.get(`/attempts/${started.body.id}/review`)
    expect(review.body.questions[0]).toMatchObject({ isCorrect: true, answerText: 'Very', correctText: 'very / extremely' })
    expect(review.body.questions[1]).toMatchObject({ isCorrect: false, correctText: 'complete' })

    const saved = await admin.post(`/assignments/${created.body.id}/bank`).send({})
    expect(saved.status).toBe(200)
    expect(saved.body.inBank).toBe(true)
    const bank = await admin.get('/exams')
    expect((bank.body as Array<{ id: string; status: string }>).find((exam) => exam.id === created.body.examId)).toMatchObject({ status: 'PUBLISHED' })
  })
})
