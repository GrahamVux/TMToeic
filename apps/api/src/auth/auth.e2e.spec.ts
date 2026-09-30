import type { INestApplication } from '@nestjs/common'
import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES } from '@toeic/shared'
import request from 'supertest'
import { DB, type Db } from '../db/database.module'
import { auditLogs } from '../db/schema'
import { ADMIN, client, createTestApp, login } from '../test/test-app'

describe('Auth, RBAC & account management (e2e on PGlite)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /health is public and checks the DB', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('rejects unauthenticated access to protected routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHENTICATED)
  })

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ identifier: 'admin', password: 'x' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe(ERROR_CODES.CSRF_REJECTED)
  })

  it('validates login payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .send({ identifier: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_FAILED)
    expect(res.body.error.details.fields.identifier).toBeDefined()
  })

  describe('bootstrap admin & forced password change', () => {
    it('logs in with HttpOnly cookies and flags mustChangePassword; blocks other routes until changed', async () => {
      const { c, res } = await login(app, ADMIN.username, ADMIN.password)
      expect(res.status).toBe(200)
      expect(res.body.user.role).toBe('ADMIN')
      expect(res.body.user.mustChangePassword).toBe(true)
      expect(JSON.stringify(res.body)).not.toMatch(/password_?hash/i)
      const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';')
      expect(cookies).toMatch(/toeic_at=.*HttpOnly/i)
      expect(cookies).toMatch(/toeic_rt=.*Path=\/api\/v1\/auth.*HttpOnly/i)

      const blocked = await c.get('/users')
      expect(blocked.status).toBe(403)
      expect(blocked.body.error.code).toBe(ERROR_CODES.PASSWORD_CHANGE_REQUIRED)

      const me = await c.get('/auth/me')
      expect(me.status).toBe(200)

      const weak = await c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'short' })
      expect(weak.status).toBe(400)
      const wrong = await c.post('/auth/change-password').send({ currentPassword: 'nope-nope-1', newPassword: 'AdminPass123' })
      expect(wrong.status).toBe(400)
      const same = await c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: ADMIN.password })
      expect(same.status).toBe(400)

      const ok = await c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
      expect(ok.status).toBe(200)
      expect(ok.body.user.mustChangePassword).toBe(false)
      expect((await c.get('/users')).status).toBe(200)

      // old password no longer works, new one does
      expect((await login(app, ADMIN.username, ADMIN.password)).res.status).toBe(401)
      expect((await login(app, ADMIN.username, 'AdminPass123')).res.status).toBe(200)
    })
  })

  describe('credential errors', () => {
    it('gives the same generic error for unknown user and wrong password', async () => {
      const a = await login(app, 'does-not-exist', 'whatever123')
      const b = await login(app, ADMIN.username, 'totally-wrong-1')
      expect(a.res.status).toBe(401)
      expect(b.res.status).toBe(401)
      expect(a.res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS)
      expect(a.res.body.error).toEqual(b.res.body.error)
    })
  })

  describe('student lifecycle (teacher flow)', () => {
    let admin: ReturnType<typeof client>
    let teacher: ReturnType<typeof client>
    let studentId: string
    let studentCode: string
    let tempPassword: string

    beforeAll(async () => {
      admin = (await login(app, ADMIN.username, 'AdminPass123')).c
      const created = await admin.post('/users/staff').send({ username: 'Teacher.Minh', fullName: 'Thầy Minh', role: 'TEACHER' })
      expect(created.status).toBe(201)
      expect(created.body.user.username).toBe('teacher.minh')
      const pw = created.body.temporaryPassword as string
      const t = await login(app, 'teacher.minh', pw)
      expect(t.res.status).toBe(200)
      await t.c.post('/auth/change-password').send({ currentPassword: pw, newPassword: 'Teacher12345' })
      teacher = t.c
    })

    it('teacher creates a student: sequential code + one-time temporary password', async () => {
      const res = await teacher.post('/users/students').send({ fullName: 'Nguyễn Thảo Linh', email: 'linh@example.com', targetScore: 850 })
      expect(res.status).toBe(201)
      expect(res.body.user.studentCode).toMatch(/^TM-\d{4,}$/)
      expect(res.body.user.role).toBe('STUDENT')
      expect(res.body.user.mustChangePassword).toBe(true)
      expect(res.body.temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/)
      studentId = res.body.user.id
      studentCode = res.body.user.studentCode
      tempPassword = res.body.temporaryPassword

      const second = await teacher.post('/users/students').send({ fullName: 'Phạm Tuấn Anh' })
      const n1 = Number(studentCode.split('-')[1])
      const n2 = Number(second.body.user.studentCode.split('-')[1])
      expect(n2).toBe(n1 + 1)
    })

    it('rejects duplicate email and invalid input', async () => {
      const dup = await teacher.post('/users/students').send({ fullName: 'Someone Else', email: 'LINH@example.com' })
      expect(dup.status).toBe(409)
      const bad = await teacher.post('/users/students').send({ fullName: 'x', email: 'not-an-email' })
      expect(bad.status).toBe(400)
    })

    it('student logs in with student code (case-insensitive), must change password, then is limited by RBAC', async () => {
      const { c, res } = await login(app, studentCode.toLowerCase(), tempPassword)
      expect(res.status).toBe(200)
      expect(res.body.user.mustChangePassword).toBe(true)
      expect((await c.get('/skills')).body.error.code).toBe(ERROR_CODES.PASSWORD_CHANGE_REQUIRED)

      const ch = await c.post('/auth/change-password').send({ currentPassword: tempPassword, newPassword: 'StudentPass99' })
      expect(ch.status).toBe(200)
      expect((await c.get('/skills')).status).toBe(200)

      const list = await c.get('/users')
      expect(list.status).toBe(403)
      expect(list.body.error.code).toBe(ERROR_CODES.FORBIDDEN)
      expect((await c.post('/users/students').send({ fullName: 'Hacker Student' })).status).toBe(403)
      expect((await c.post(`/users/${studentId}/reset-password`)).status).toBe(403)
    })

    it('RBAC: teacher cannot create staff, only sees students, cannot reach staff accounts', async () => {
      expect((await teacher.post('/users/staff').send({ username: 'evil', fullName: 'Evil Admin', role: 'ADMIN' })).status).toBe(403)

      const list = await teacher.get('/users?pageSize=100')
      expect(list.status).toBe(200)
      expect(list.body.items.length).toBeGreaterThan(0)
      expect(list.body.items.every((u: { role: string }) => u.role === 'STUDENT')).toBe(true)

      const adminList = await admin.get('/users?role=ADMIN')
      const adminId = adminList.body.items[0].id
      expect((await teacher.get(`/users/${adminId}`)).status).toBe(404)
      expect((await teacher.post(`/users/${adminId}/reset-password`)).status).toBe(404)
      expect((await teacher.post(`/users/${adminId}/disable`)).status).toBe(404)
    })

    it('search + pagination', async () => {
      const res = await teacher.get('/users?q=th%E1%BA%A3o&pageSize=1')
      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].fullName).toBe('Nguyễn Thảo Linh')
      // LIKE wildcards are escaped, not interpreted
      const wild = await teacher.get('/users?q=%25')
      expect(wild.body.total).toBe(0)
    })

    it('student stats are consistent with the list and readable by teachers only', async () => {
      const stats = await teacher.get('/users/stats/students')
      expect(stats.status).toBe(200)
      const all = await teacher.get('/users?pageSize=100')
      expect(stats.body.total).toBe(all.body.total)
      expect(stats.body.active + stats.body.disabled).toBe(stats.body.total)
      expect(stats.body.pendingFirstLogin).toBeGreaterThanOrEqual(1) // "Phạm Tuấn Anh" never logged in

      const { c } = await login(app, studentCode, 'StudentPass99')
      expect((await c.get('/users/stats/students')).status).toBe(403)
    })

    it('reset password: new temp password works, old one is dead, sessions are revoked', async () => {
      const { c } = await login(app, studentCode, 'StudentPass99')
      expect((await c.get('/skills')).status).toBe(200)

      const reset = await teacher.post(`/users/${studentId}/reset-password`)
      expect(reset.status).toBe(200)
      const fresh = reset.body.temporaryPassword as string
      expect(fresh).not.toBe(tempPassword)

      expect((await c.get('/skills')).status).toBe(401) // existing session revoked
      expect((await login(app, studentCode, 'StudentPass99')).res.status).toBe(401)
      const again = await login(app, studentCode, fresh)
      expect(again.res.status).toBe(200)
      expect(again.res.body.user.mustChangePassword).toBe(true)
      await again.c.post('/auth/change-password').send({ currentPassword: fresh, newPassword: 'StudentPass99' })
    })

    it('disable/enable account: kills sessions, blocks login, can be restored', async () => {
      const { c } = await login(app, studentCode, 'StudentPass99')
      expect((await c.get('/skills')).status).toBe(200)

      const off = await teacher.post(`/users/${studentId}/disable`)
      expect(off.status).toBe(200)
      expect(off.body.status).toBe('DISABLED')

      expect((await c.get('/skills')).status).toBe(401)
      const blocked = await login(app, studentCode, 'StudentPass99')
      expect(blocked.res.status).toBe(403)
      expect(blocked.res.body.error.code).toBe(ERROR_CODES.ACCOUNT_DISABLED)
      // wrong password on a disabled account must not reveal the status
      expect((await login(app, studentCode, 'wrong-pass-1')).res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS)

      expect((await teacher.post(`/users/${studentId}/enable`)).status).toBe(200)
      expect((await login(app, studentCode, 'StudentPass99')).res.status).toBe(200)
    })

    it('admins cannot disable themselves', async () => {
      const adminId = (await admin.get('/users?role=ADMIN')).body.items[0].id
      const res = await admin.post(`/users/${adminId}/disable`)
      expect(res.status).toBe(400)
    })

    it('records an audit trail for sensitive actions, without secrets', async () => {
      const db = app.get<Db>(DB)
      const rows = await db.select().from(auditLogs)
      const actions = new Set(rows.map((r) => r.action))
      for (const a of ['AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_PASSWORD_CHANGED', 'USER_CREATED', 'USER_PASSWORD_RESET', 'USER_DISABLED', 'USER_ENABLED']) {
        expect(actions).toContain(a)
      }
      const created = rows.find((r) => r.action === 'USER_CREATED' && r.entityId === studentId)!
      expect(created.actorId).toBeTruthy()
      const blob = JSON.stringify(rows)
      expect(blob).not.toContain(tempPassword)
      expect(blob).not.toContain('StudentPass99')
    })
  })

  describe('account lockout', () => {
    it('locks after N failed attempts, even for the right password, and unlocks on admin reset', async () => {
      const admin = (await login(app, ADMIN.username, 'AdminPass123')).c
      const created = await admin.post('/users/students').send({ fullName: 'Lock Test Student' })
      const code = created.body.user.studentCode as string
      const temp = created.body.temporaryPassword as string

      for (let i = 0; i < 3; i++) {
        expect((await login(app, code, 'wrong-password-1')).res.status).toBe(401)
      }
      const locked = await login(app, code, temp)
      expect(locked.res.status).toBe(429)
      expect(locked.res.body.error.code).toBe(ERROR_CODES.TOO_MANY_REQUESTS)

      const reset = await admin.post(`/users/${created.body.user.id}/reset-password`)
      const ok = await login(app, code, reset.body.temporaryPassword)
      expect(ok.res.status).toBe(200)
    })
  })

  describe('session refresh & logout', () => {
    const cookieOf = (res: request.Response, name: string) => {
      const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${name}=`))!
      return raw.split(';')[0]
    }

    it('rotates the refresh token and revokes the session if an old token is replayed', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set(CSRF_HEADER, CSRF_HEADER_VALUE)
        .send({ identifier: ADMIN.username, password: 'AdminPass123' })
      const rt1 = cookieOf(first, 'toeic_rt')

      const refreshed = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set(CSRF_HEADER, CSRF_HEADER_VALUE).set('Cookie', rt1)
      expect(refreshed.status).toBe(200)
      const rt2 = cookieOf(refreshed, 'toeic_rt')
      const at2 = cookieOf(refreshed, 'toeic_at')
      expect(rt2).not.toBe(rt1)

      // new access token works
      expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', at2)).status).toBe(200)

      // replaying the OLD refresh token => theft signal => whole session revoked
      const replay = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set(CSRF_HEADER, CSRF_HEADER_VALUE).set('Cookie', rt1)
      expect(replay.status).toBe(401)
      expect(replay.body.error.code).toBe(ERROR_CODES.SESSION_EXPIRED)
      const afterReplay = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set(CSRF_HEADER, CSRF_HEADER_VALUE).set('Cookie', rt2)
      expect(afterReplay.status).toBe(401)
      expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', at2)).status).toBe(401)
    })

    it('refresh without/with garbage cookie is rejected', async () => {
      const none = await request(app.getHttpServer()).post('/api/v1/auth/refresh').set(CSRF_HEADER, CSRF_HEADER_VALUE)
      expect(none.status).toBe(401)
      const junk = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set(CSRF_HEADER, CSRF_HEADER_VALUE)
        .set('Cookie', 'toeic_rt=not-a-token')
      expect(junk.status).toBe(401)
    })

    it('logout revokes the session server-side', async () => {
      const { c, res } = await login(app, ADMIN.username, 'AdminPass123')
      const at = cookieOf(res, 'toeic_at')
      expect((await c.get('/auth/me')).status).toBe(200)
      expect((await c.post('/auth/logout')).status).toBe(204)
      expect((await c.get('/auth/me')).status).toBe(401)
      // even a copied access token is dead after logout
      expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', at)).status).toBe(401)
    })

    it('lists own sessions and lets the user sign out another device', async () => {
      const a = await login(app, ADMIN.username, 'AdminPass123')
      const b = await login(app, ADMIN.username, 'AdminPass123')
      const list = await a.c.get('/auth/sessions')
      expect(list.status).toBe(200)
      expect(list.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
      const other = (await b.c.get('/auth/sessions')).body.find((s: { current: boolean }) => s.current)
      expect((await a.c.delete(`/auth/sessions/${other.id}`)).status).toBe(204)
      expect((await b.c.get('/auth/me')).status).toBe(401)
      expect((await a.c.get('/auth/me')).status).toBe(200)
    })

    it('password change signs out other devices', async () => {
      const a = await login(app, ADMIN.username, 'AdminPass123')
      const b = await login(app, ADMIN.username, 'AdminPass123')
      const ch = await a.c.post('/auth/change-password').send({ currentPassword: 'AdminPass123', newPassword: 'AdminPass456' })
      expect(ch.status).toBe(200)
      expect((await b.c.get('/auth/me')).status).toBe(401)
      expect((await a.c.get('/auth/me')).status).toBe(200) // current device stays signed in
    })
  })

  describe('catalog (generic Skill/Part)', () => {
    it('seeds 4 skills with only Listening & Reading enabled, 7 parts', async () => {
      const { c } = await login(app, ADMIN.username, 'AdminPass456')
      const res = await c.get('/skills')
      expect(res.status).toBe(200)
      const byCode = Object.fromEntries(res.body.map((s: { code: string }) => [s.code, s]))
      expect(Object.keys(byCode).sort()).toEqual(['LISTENING', 'READING', 'SPEAKING', 'WRITING'])
      expect(byCode.LISTENING.enabled).toBe(true)
      expect(byCode.READING.enabled).toBe(true)
      expect(byCode.SPEAKING.enabled).toBe(false)
      expect(byCode.WRITING.enabled).toBe(false)
      expect(byCode.LISTENING.parts.map((p: { code: string }) => p.code)).toEqual(['PART_1', 'PART_2', 'PART_3', 'PART_4'])
      expect(byCode.READING.parts.map((p: { code: string }) => p.code)).toEqual(['PART_5', 'PART_6', 'PART_7'])
    })
  })
})
