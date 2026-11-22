import type { INestApplication } from '@nestjs/common'
import { AVATAR_MAX_BYTES, VIEW_AS_HEADER } from '@toeic/shared'
import sharp from 'sharp'
import { ADMIN, client, createTestApp, login, type TestClient } from '../test/test-app'

describe('Account avatars', () => {
  let app: INestApplication
  let admin: TestClient
  let student: TestClient
  let teacher: TestClient
  let studentId: string
  let teacherId: string
  let png: Buffer

  beforeAll(async () => {
    app = await createTestApp()
    admin = (await login(app, ADMIN.username, ADMIN.password)).c
    await admin.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' }).expect(200)
    const s = await admin.post('/users/students').send({ fullName: 'Học viên Avatar' }).expect(201)
    const t = await admin.post('/users/staff').send({ role: 'TEACHER', username: 'teacher.avatar', fullName: 'Giáo viên Avatar' }).expect(201)
    studentId = s.body.user.id
    teacherId = t.body.user.id
    student = (await login(app, s.body.user.studentCode, s.body.temporaryPassword)).c
    teacher = (await login(app, t.body.user.username, t.body.temporaryPassword)).c
    await student.post('/auth/change-password').send({ currentPassword: s.body.temporaryPassword, newPassword: 'StudentPass123' }).expect(200)
    await teacher.post('/auth/change-password').send({ currentPassword: t.body.temporaryPassword, newPassword: 'TeacherPass123' }).expect(200)
    png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#328072' } }).png().toBuffer()
  })
  afterAll(() => app.close())

  const upload = (c: TestClient, body = png) => c.post('/me/avatar').set('Content-Type', 'image/png').send(body)

  it('stores a private thumbnail, shares the version with the roster, then replaces and removes it', async () => {
    const first = await upload(student).expect(200)
    expect(first.body.id).toBe(studentId)
    const path: string = first.body.avatarUrl
    const image = await admin.agent.get(path).expect(200).expect('Content-Type', /image\/webp/)
    expect(await sharp(image.body).metadata()).toMatchObject({ width: 192, height: 192, format: 'webp' })
    await client(app).agent.get(path).expect(401)
    expect((await admin.get('/users/' + studentId)).body.avatarUrl).toBe(path)
    expect((await student.get('/auth/me')).body.user.avatarUrl).toBe(path)

    await upload(student, Buffer.from('invalid image')).expect(400)
    await upload(student, Buffer.alloc(AVATAR_MAX_BYTES + 1)).expect(413)
    expect((await student.get('/auth/me')).body.user.avatarUrl).toBe(path)
    const next = await upload(student).expect(200)
    expect(next.body.avatarUrl).not.toBe(path)
    await student.agent.get(path).expect(404)
    await admin.delete('/me/avatar').set(VIEW_AS_HEADER, studentId).expect(403)
    await student.delete('/me/avatar').expect(200, { id: studentId, avatarUrl: null })
    await student.agent.get(next.body.avatarUrl).expect(404)
    expect((await admin.get('/users/' + studentId)).body.avatarUrl).toBeNull()
  })

  it('lets staff manage their own picture and uses the teacher picture in the class list', async () => {
    const own = await upload(admin).expect(200)
    const photo = await upload(teacher).expect(200)
    expect(own.body.avatarUrl).not.toBe(photo.body.avatarUrl)
    const room = await admin.post('/classes').send({ name: 'Lớp ảnh đại diện' }).expect(201)
    await admin.agent.put('/api/v1/classes/' + room.body.id + '/teachers').set('x-toeic-client', 'web').send({ teacherIds: [teacherId] }).expect(200)
    const rooms = await admin.get('/classes').expect(200)
    expect(rooms.body.find((r: { id: string }) => r.id === room.body.id).teachers[0].avatarUrl).toBe(photo.body.avatarUrl)
    await upload(admin).set(VIEW_AS_HEADER, teacherId).expect(403)
    await admin.delete('/me/avatar').expect(200)
    expect((await teacher.get('/auth/me')).body.user.avatarUrl).toBe(photo.body.avatarUrl)
  })
})
