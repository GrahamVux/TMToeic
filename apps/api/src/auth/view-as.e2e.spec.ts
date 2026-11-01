import type { INestApplication } from '@nestjs/common'
import { ERROR_CODES, VIEW_AS_HEADER } from '@toeic/shared'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../db/database.module'
import { auditLogs } from '../db/schema'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'

describe('Admin previews teacher and student screens (e2e)', () => {
  let app: INestApplication
  let admin: TestClient
  let studentId: string
  let studentCode: string
  let teacherId: string
  let student: TestClient

  beforeAll(async () => {
    app = await createTestApp()
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c

    const s = await admin.post('/users/students').send({ fullName: 'Học viên xem thử' })
    studentId = s.body.user.id as string
    studentCode = s.body.user.studentCode as string
    student = (await login(app, studentCode, s.body.temporaryPassword as string)).c

    const t = await admin.post('/users/staff').send({
      username: 'cogiao',
      fullName: 'Cô giáo xem thử',
      role: 'TEACHER',
      permissions: { createStudents: false, manageAssignments: true, viewProgress: false },
    })
    teacherId = t.body.user.id as string
  })

  afterAll(() => app.close())

  const asStudent = () => admin.get('/auth/me').set(VIEW_AS_HEADER, studentId)

  it('starts a preview, records it in the audit log and never marks the previewed account as needing a password change', async () => {
    const res = await admin.post('/auth/view-as').send({ userId: studentId })
    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(studentId)
    expect(res.body.user.mustChangePassword).toBe(false)
    expect(res.body.viewingAs.admin.role).toBe('ADMIN')

    const rows = await app.get<Db>(DB).select().from(auditLogs).where(eq(auditLogs.action, 'ADMIN_VIEW_AS'))
    expect(rows.some((r) => r.entityId === studentId)).toBe(true)
  })

  it('answers as the previewed student for reads', async () => {
    const me = await asStudent()
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe(studentId)
    expect(me.body.user.role).toBe('STUDENT')
    expect(me.body.viewingAs.admin.username).toBe(ADMIN.username)

    // A student-only route is closed to the admin for real and open while previewing a student.
    expect((await admin.get('/me/dashboard')).status).toBe(403)
    expect((await admin.get('/me/dashboard').set(VIEW_AS_HEADER, studentId)).status).toBe(200)
  })

  it('answers with the previewed teacher grants', async () => {
    const me = await admin.get('/auth/me').set(VIEW_AS_HEADER, teacherId)
    expect(me.body.user.role).toBe('TEACHER')
    expect(me.body.user.permissions).toEqual({ createStudents: false, manageAssignments: true, viewProgress: false })

    // Staff routes honour the teacher's grants. This teacher manages assignments but cannot view progress.
    expect((await admin.get('/assignments').set(VIEW_AS_HEADER, teacherId)).status).toBe(200)
    expect((await admin.get(`/students/${studentId}/progress`)).status).toBe(200)
    expect((await admin.get(`/students/${studentId}/progress`).set(VIEW_AS_HEADER, teacherId)).status).toBe(403)
  })

  it('refuses every change while previewing', async () => {
    const res = await admin.post('/users/students').set(VIEW_AS_HEADER, teacherId).send({ fullName: 'Không được tạo' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe(ERROR_CODES.VIEW_ONLY)

    const reset = await admin.post(`/users/${studentId}/reset-password`).set(VIEW_AS_HEADER, studentId)
    expect(reset.status).toBe(403)
    expect(reset.body.error.code).toBe(ERROR_CODES.VIEW_ONLY)
  })

  it('ignores the header from anyone who is not an admin', async () => {
    const me = await student.get('/auth/me').set(VIEW_AS_HEADER, teacherId)
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe(studentId)
    expect(me.body.viewingAs).toBeUndefined()

    const start = await student.post('/auth/view-as').send({ userId: teacherId })
    expect(start.status).toBe(403)
  })

  it('rejects a malformed or unknown account and another admin', async () => {
    expect((await admin.get('/auth/me').set(VIEW_AS_HEADER, 'nope')).status).toBe(400)
    expect((await admin.get('/auth/me').set(VIEW_AS_HEADER, '00000000-0000-4000-8000-000000000000')).status).toBe(404)

    const adminId = (await admin.get('/auth/me')).body.user.id as string
    expect((await admin.post('/auth/view-as').send({ userId: adminId })).status).toBe(403)
  })

  it('shows the admin again once the header is gone', async () => {
    const me = await admin.get('/auth/me')
    expect(me.body.user.role).toBe('ADMIN')
    expect(me.body.viewingAs).toBeUndefined()
  })
})
