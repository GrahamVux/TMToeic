import type { INestApplication } from '@nestjs/common'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'

describe('Bug reports (e2e on PGlite)', () => {
  let app: INestApplication
  let admin: TestClient
  let teacher: TestClient
  let student: TestClient
  let other: TestClient
  const patch = (c: TestClient, url: string, body: object) => c.agent.patch(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)

  async function newStudent(name: string): Promise<TestClient> {
    const created = await admin.post('/users/students').send({ fullName: name })
    const temp = created.body.temporaryPassword as string
    const { c } = await login(app, created.body.user.studentCode, temp)
    expect((await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'StudentPass99' })).status).toBe(200)
    return c
  }

  beforeAll(async () => {
    app = await createTestApp()
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c

    const created = await admin.post('/users/staff').send({ username: 'teacher.bugs', fullName: 'Thầy Bugs', role: 'TEACHER' })
    const temp = created.body.temporaryPassword as string
    const t = await login(app, 'teacher.bugs', temp)
    await t.c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'TeacherPass99' })
    teacher = t.c

    student = await newStudent('Học Viên Báo Lỗi')
    other = await newStudent('Học Viên Khác')
  })
  afterAll(async () => {
    await app.close()
  })

  it('lets a student file a report that only admin can list and resolve', async () => {
    const created = await student.post('/bug-reports').send({
      category: 'UI',
      message: 'Nút nộp bài trên trang luyện tập không phản hồi khi bấm.',
      pagePath: '/practice',
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      category: 'UI',
      status: 'OPEN',
      pagePath: '/practice',
      adminNote: null,
    })
    expect(created.body.message).toContain('Nút nộp bài')
    const id = created.body.id as string

    const mine = await student.get('/bug-reports/mine')
    expect(mine.status).toBe(200)
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0].id).toBe(id)

    const otherMine = await other.get('/bug-reports/mine')
    expect(otherMine.body.items).toHaveLength(0)

    expect((await teacher.get('/bug-reports')).status).toBe(403)
    expect((await student.get('/bug-reports')).status).toBe(403)
    expect((await teacher.get('/bug-reports/summary')).status).toBe(403)

    const listed = await admin.get('/bug-reports')
    expect(listed.status).toBe(200)
    expect(listed.body.openCount).toBe(1)
    expect(listed.body.items[0]).toMatchObject({
      id,
      reporter: { fullName: 'Học Viên Báo Lỗi' },
      status: 'OPEN',
    })

    const summary = await admin.get('/bug-reports/summary')
    expect(summary.body.openCount).toBe(1)

    const resolved = await patch(admin, `/bug-reports/${id}`, {
      status: 'RESOLVED',
      adminNote: 'Đã sửa nút nộp bài trên bản mới.',
    })
    expect(resolved.status).toBe(200)
    expect(resolved.body).toMatchObject({ status: 'RESOLVED', adminNote: 'Đã sửa nút nộp bài trên bản mới.' })
    expect(resolved.body.resolvedByName).toBeTruthy()

    expect((await admin.get('/bug-reports/summary')).body.openCount).toBe(0)
    expect((await student.get('/bug-reports/mine')).body.items[0]).toMatchObject({
      status: 'RESOLVED',
      adminNote: 'Đã sửa nút nộp bài trên bản mới.',
    })
  })

  it('rejects empty descriptions and does not let teachers patch reports', async () => {
    expect((await student.post('/bug-reports').send({ message: 'ngắn' })).status).toBe(400)
    const ok = await student.post('/bug-reports').send({ message: 'Trang tiến độ không hiện biểu đồ điểm sau khi nộp bài.' })
    expect(ok.status).toBe(201)
    expect((await patch(teacher, `/bug-reports/${ok.body.id}`, { status: 'CLOSED' })).status).toBe(403)
    expect((await patch(student, `/bug-reports/${ok.body.id}`, { status: 'CLOSED' })).status).toBe(403)
  })
})
