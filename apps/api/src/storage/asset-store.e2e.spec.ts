import type { INestApplication } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { DB, type Db } from '../db/database.module'
import { assets, exams } from '../db/schema'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'

describe('Uploads are recorded in the database, then pushed to object storage (e2e, fake R2)', () => {
  let app: INestApplication
  let db: Db
  let admin: TestClient
  let adminId: string
  let seq = 0

  /** What the database held for each object at the moment its bytes were pushed. */
  const seenAtPush = new Map<string, string | undefined>()
  const pushed = new Map<string, Buffer>()
  let failPush = false
  const storage = {
    enabled: true,
    bucket: 'toeic-content',
    signedGetUrl: (key: string) => Promise.resolve(`https://r2.test/${key}?sig=fake`),
    putObject: async (key: string, body: Buffer) => {
      const [row] = await db.select({ status: assets.status }).from(assets).where(eq(assets.objectKey, key)).limit(1)
      seenAtPush.set(key, row?.status)
      if (failPush) throw new Error('R2 is unreachable')
      pushed.set(key, body)
    },
  }

  const latestAsset = async () => (await db.select().from(assets).orderBy(desc(assets.createdAt)).limit(1))[0]!
  const sourceOf = async (examId: string) => (await db.select({ id: exams.sourceAssetId }).from(exams).where(eq(exams.id, examId)).limit(1))[0]!.id

  const listening = () => ({
    code: `PIPE-${++seq}-${Date.now()}`,
    title: `Pipeline exam ${seq}`,
    durationSeconds: 600,
    publish: true,
    parts: [{ partCode: 'PART_2', questionStart: 1, questionEnd: 1 }],
    groups: [],
    questions: [{ partCode: 'PART_2', number: 1, prompt: 'Where?', options: ['A', 'B', 'C'].map((key) => ({ key, text: key, correct: key === 'A' })) }],
  })

  const postRaw = (url: string, type: string, name: string, body: Buffer) =>
    admin.agent.post(`/api/v1${url}?filename=${encodeURIComponent(name)}`).set('x-toeic-client', 'web').set('content-type', type).send(body)

  beforeAll(async () => {
    app = await createTestApp({}, { storage })
    db = app.get<Db>(DB)
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
    adminId = (await admin.get('/auth/me')).body.user.id as string
    // Homework needs at least one student to be handed to.
    expect((await admin.post('/users/students').send({ fullName: 'Học Viên Kho File' })).status).toBe(201)
  })
  afterAll(() => app.close())
  beforeEach(() => {
    failPush = false
    storage.enabled = true
  })

  it('records an audio file as pending before the push and as stored once the push is confirmed', async () => {
    const exam = await admin.post('/exams/import-authored').send(listening())
    expect(exam.status).toBe(201)
    const clip = Buffer.from('ID3-fake-mp3')

    expect((await postRaw(`/exams/${exam.body.id}/audio/file`, 'audio/mpeg', 'bai-nghe.mp3', clip)).status).toBe(200)

    const asset = await latestAsset()
    expect(seenAtPush.get(asset.objectKey)).toBe('PENDING')
    expect(pushed.get(asset.objectKey)).toEqual(clip)
    expect(asset).toMatchObject({
      status: 'STORED',
      error: null,
      provider: 'CLOUDFLARE_R2',
      bucket: 'toeic-content',
      mimeType: 'audio/mpeg',
      sizeBytes: clip.length,
      checksum: createHash('sha256').update(clip).digest('hex'),
      originalFilename: 'bai-nghe.mp3',
      uploadedBy: adminId,
    })
    expect(asset.storedAt).toBeInstanceOf(Date)
    expect((await admin.get(`/exams/${exam.body.id}`)).body.hasAudio).toBe(true)
  })

  it('keeps a failed push on record and never attaches or serves that file', async () => {
    const exam = await admin.post('/exams/import-authored').send(listening())
    failPush = true
    const res = await postRaw(`/exams/${exam.body.id}/audio/file`, 'audio/mpeg', 'loi.mp3', Buffer.from('ID3-fake-mp3'))
    expect(res.status).toBe(400)

    const asset = await latestAsset()
    expect(asset).toMatchObject({ status: 'FAILED', error: 'R2 is unreachable', storedAt: null, originalFilename: 'loi.mp3' })
    expect(pushed.has(asset.objectKey)).toBe(false)
    expect((await admin.get(`/exams/${exam.body.id}`)).body.hasAudio).toBe(false)

    const attach = await admin.agent.put(`/api/v1/exams/${exam.body.id}/audio`).set('x-toeic-client', 'web').send({ assetId: asset.id })
    expect(attach.status).toBe(400)
    expect((await admin.get(`/exams/${exam.body.id}`)).body.hasAudio).toBe(false)
  })

  it('stores homework photos through the same path', async () => {
    const exam = await admin.post('/exams/import-authored').send(listening())
    const homework = await admin.post('/assignments').send({ title: 'Ảnh đề', examId: exam.body.id, partCodes: ['PART_2'], durationSeconds: 300 })
    expect(homework.status).toBe(201)
    const photo = Buffer.from('jpeg-bytes')

    expect((await postRaw(`/assignments/${homework.body.id}/images`, 'image/jpeg', 'trang-1.jpg', photo)).status).toBe(200)
    const asset = await latestAsset()
    expect(seenAtPush.get(asset.objectKey)).toBe('PENDING')
    expect(asset).toMatchObject({ status: 'STORED', mimeType: 'image/jpeg', sizeBytes: photo.length, uploadedBy: adminId })
    expect(asset.objectKey).toMatch(new RegExp(`^assignments/${homework.body.id}/images/`))

    failPush = true
    expect((await postRaw(`/assignments/${homework.body.id}/images`, 'image/jpeg', 'trang-2.jpg', photo)).status).toBe(400)
    expect((await latestAsset()).status).toBe('FAILED')
    expect((await admin.get('/assignments')).body.find((a: { id: string }) => a.id === homework.body.id)).toMatchObject({ imageCount: 1 })
  })

  it('keeps the uploaded exam JSON in object storage and links it to the exam', async () => {
    const input = listening()
    const exam = await admin.post('/exams/import-authored').send(input)
    expect(exam.status).toBe(201)

    const sourceId = await sourceOf(exam.body.id)
    expect(sourceId).toBeTruthy()
    const [asset] = await db.select().from(assets).where(eq(assets.id, sourceId!))
    expect(asset).toMatchObject({ status: 'STORED', mimeType: 'application/json', uploadedBy: adminId })
    expect(asset.objectKey).toMatch(new RegExp(`^exams/${exam.body.id}/source/\\d+\\.json$`))
    expect(seenAtPush.get(asset.objectKey)).toBe('PENDING')
    expect(JSON.parse(pushed.get(asset.objectKey)!.toString('utf8'))).toMatchObject({ code: input.code, title: input.title, questions: [{ number: 1, prompt: 'Where?' }] })
  })

  it('keeps the cloze JSON of a fill-in homework', async () => {
    const created = await admin.post('/assignments/fill').send({
      title: 'Điền từ kho file',
      durationSeconds: 600,
      items: [{ prompt: 'The train was ___ late.', answers: ['very | extremely'] }],
    })
    expect(created.status).toBe(201)
    const sourceId = await sourceOf(created.body.examId)
    const [asset] = await db.select().from(assets).where(eq(assets.id, sourceId!))
    expect(asset).toMatchObject({ status: 'STORED', mimeType: 'application/json' })
    expect(JSON.parse(pushed.get(asset.objectKey)!.toString('utf8'))).toMatchObject({ title: 'Điền từ kho file', items: [{ prompt: 'The train was ___ late.' }] })
  })

  it('still saves the exam when the JSON copy cannot be pushed or storage is off', async () => {
    failPush = true
    const failed = await admin.post('/exams/import-authored').send(listening())
    expect(failed.status).toBe(201)
    expect(failed.body.status).toBe('PUBLISHED')
    expect(await sourceOf(failed.body.id)).toBeNull()
    expect(await latestAsset()).toMatchObject({ status: 'FAILED', mimeType: 'application/json' })

    failPush = false
    storage.enabled = false
    const before = (await db.select({ id: assets.id }).from(assets)).length
    const off = await admin.post('/exams/import-authored').send(listening())
    expect(off.status).toBe(201)
    expect(await sourceOf(off.body.id)).toBeNull()
    expect((await db.select({ id: assets.id }).from(assets)).length).toBe(before)
  })
})
