import type { INestApplication } from '@nestjs/common'
import { DEFAULT_SITE_SETTINGS } from '@toeic/shared'
import { ADMIN, client, createTestApp, login, type TestClient } from '../test/test-app'

describe('Site settings (e2e on PGlite)', () => {
  let app: INestApplication
  let admin: TestClient
  let teacher: TestClient
  const put = (c: TestClient, url: string, body: object) => c.agent.put(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)

  beforeAll(async () => {
    app = await createTestApp()
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c

    const created = await admin.post('/users/staff').send({ username: 'teacher.site', fullName: 'Thầy Site', role: 'TEACHER' })
    const temp = created.body.temporaryPassword as string
    const t = await login(app, 'teacher.site', temp)
    await t.c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'TeacherPass99' })
    teacher = t.c
  })
  afterAll(async () => {
    await app.close()
  })

  it('is publicly readable with the seeded branding', async () => {
    const anon = client(app)
    const res = await anon.get('/site-settings')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      brandName: DEFAULT_SITE_SETTINGS.brandName,
      slogan: DEFAULT_SITE_SETTINGS.slogan,
      phone: DEFAULT_SITE_SETTINGS.phone,
      theme: DEFAULT_SITE_SETTINGS.theme,
      backgroundMode: 'fixed',
      logoUrl: null,
    })
  })

  it('only the admin can change branding, theme, footer and contact; the change is persisted', async () => {
    expect((await put(teacher, '/site-settings', { slogan: 'Không được' })).status).toBe(403)

    const res = await put(admin, '/site-settings', {
      brandName: 'MINH TOEIC PRO',
      slogan: 'Lớp 900+',
      phone: '0909.123.456',
      address: '12 Nguyễn Huệ, Q.1',
      footerAbout: 'Cổng học mới.',
      theme: { primary: '#0f766e', primarySoft: '#99f6e4', paper: '#f0fdfa' },
      backgroundMode: 'sky',
      logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      brandName: 'MINH TOEIC PRO',
      slogan: 'Lớp 900+',
      phone: '0909.123.456',
      address: '12 Nguyễn Huệ, Q.1',
      footerAbout: 'Cổng học mới.',
      theme: { primary: '#0f766e', primarySoft: '#99f6e4', paper: '#f0fdfa' },
      backgroundMode: 'sky',
    })
    expect(res.body.logoUrl).toMatch(/^data:image\/png;base64,/)
    expect(res.body.theme.button).toBe('#1f7a8c')

    const colored = await put(admin, '/site-settings', {
      theme: { primary: '#0f766e', primarySoft: '#99f6e4', paper: '#f0fdfa', button: '#123456' },
    })
    expect(colored.status).toBe(200)
    expect(colored.body.theme.button).toBe('#123456')

    const again = await client(app).get('/site-settings')
    expect(again.body.slogan).toBe('Lớp 900+')
    expect(again.body.logoUrl).toBe(res.body.logoUrl)

    expect((await put(admin, '/site-settings', { theme: { primary: 'teal', primarySoft: '#99f6e4', paper: '#f0fdfa' } })).status).toBe(400)
    expect((await put(admin, '/site-settings', { theme: { primary: '#0f766e', primarySoft: '#99f6e4', paper: '#f0fdfa', button: 'blue' } })).status).toBe(400)
    expect((await put(admin, '/site-settings', { backgroundMode: 'sunset' })).status).toBe(400)
    expect((await put(admin, '/site-settings', { backgroundMode: 'fixed' })).status).toBe(200)
  })
})
