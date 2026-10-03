import type { INestApplication } from '@nestjs/common'
import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES } from '@toeic/shared'
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
})

describe('Assignment audio and sheet images', () => {
  let app: INestApplication
  let admin: TestClient
  let student: TestClient
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
})
