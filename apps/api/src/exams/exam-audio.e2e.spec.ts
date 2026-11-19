import type { INestApplication } from '@nestjs/common'
import type { AudioTrackDto } from '@toeic/shared'
import { DB, type Db } from '../db/database.module'
import { assets } from '../db/schema'
import { ADMIN, createTestApp, login, type TestClient } from '../test/test-app'
import { partsLabel, planAudioTracks } from './exam-audio'

describe('planAudioTracks / partsLabel (pure)', () => {
  const eps = [
    { code: 'PART_1', skill: 'LISTENING', audioAssetId: null },
    { code: 'PART_2', skill: 'LISTENING', audioAssetId: null },
    { code: 'PART_3', skill: 'LISTENING', audioAssetId: null },
    { code: 'PART_4', skill: 'LISTENING', audioAssetId: null },
    { code: 'PART_5', skill: 'READING', audioAssetId: null },
  ]
  const all = eps.map((p) => p.code)

  it('full-length audio covers every Listening part of a full attempt (and never Reading)', () => {
    expect(planAudioTracks({ examAssetId: 'full', examParts: eps, scopeCodes: all })).toEqual([{ assetId: 'full', partCodes: ['PART_1', 'PART_2', 'PART_3', 'PART_4'] }])
  })

  it('does not offer a full-length file for a partial Listening scope', () => {
    expect(planAudioTracks({ examAssetId: 'full', examParts: eps, scopeCodes: ['PART_3'] })).toEqual([])
    expect(planAudioTracks({ examAssetId: 'full', examParts: eps, scopeCodes: ['PART_5'] })).toEqual([])
  })

  it('part-level recordings win, merge across parts, and work for drills', () => {
    const split = eps.map((p) => (p.code === 'PART_1' || p.code === 'PART_2' ? { ...p, audioAssetId: 'p12' } : p.code === 'PART_3' ? { ...p, audioAssetId: 'p3' } : p))
    expect(planAudioTracks({ examAssetId: null, examParts: split, scopeCodes: ['PART_3'] })).toEqual([{ assetId: 'p3', partCodes: ['PART_3'] }])
    expect(planAudioTracks({ examAssetId: null, examParts: split, scopeCodes: all })).toEqual([
      { assetId: 'p12', partCodes: ['PART_1', 'PART_2'] },
      { assetId: 'p3', partCodes: ['PART_3'] },
    ])
    // Full scope: Part 4 has no own file → falls back to the full-length one.
    expect(planAudioTracks({ examAssetId: 'full', examParts: split, scopeCodes: all }).map((t) => t.assetId)).toEqual(['p12', 'p3', 'full'])
  })

  it('labels', () => {
    expect(partsLabel(['PART_1', 'PART_2', 'PART_3', 'PART_4'])).toBe('Part 1–4')
    expect(partsLabel(['PART_3'])).toBe('Part 3')
    expect(partsLabel(['PART_1', 'PART_3'])).toBe('Part 1, 3')
  })
})

describe('Listening audio (e2e on PGlite, fake R2 signer)', () => {
  let app: INestApplication
  let db: Db
  let admin: TestClient
  let student: TestClient
  let other: TestClient
  let examId: string
  let fullAudioId: string
  let part2AudioId: string
  let pdfId: string
  const uploaded: string[] = []
  const storage = {
    enabled: true,
    bucket: 'toeic-content',
    signedGetUrl: (key: string, ttl: number) => Promise.resolve(`https://r2.test/${key}?X-Amz-Expires=${ttl}&X-Amz-Signature=fake`),
    deleteObject: () => Promise.resolve(),
    putObject: (key: string) => {
      uploaded.push(key)
      return Promise.resolve()
    },
  }

  const put = (c: TestClient, url: string, body: object) => c.agent.put(`/api/v1${url}`).set('x-toeic-client', 'web').send(body)
  const audioOf = (body: { audio: AudioTrackDto[] }) => body.audio

  async function newStudent(name: string): Promise<TestClient> {
    const created = await admin.post('/users/students').send({ fullName: name })
    const temp = created.body.temporaryPassword as string
    const { c } = await login(app, created.body.user.studentCode as string, temp)
    await c.post('/auth/change-password').send({ currentPassword: temp, newPassword: 'StudentPass99' })
    return c
  }

  beforeAll(async () => {
    app = await createTestApp({}, { storage })
    db = app.get<Db>(DB)
    const a = await login(app, ADMIN.username, ADMIN.password)
    await a.c.post('/auth/change-password').send({ currentPassword: ADMIN.password, newPassword: 'AdminPass123' })
    admin = a.c
    student = await newStudent('Nghe Một')
    other = await newStudent('Nghe Hai')

    const rows = await db
      .insert(assets)
      .values([
        { provider: 'CLOUDFLARE_R2', bucket: 'toeic-content', objectKey: 'ets-2018/test-01/audio/full.mp3', mimeType: 'audio/mpeg' },
        { provider: 'CLOUDFLARE_R2', bucket: 'toeic-content', objectKey: 'ets-2018/test-01/audio/p2.mp3', mimeType: 'audio/mpeg' },
        { provider: 'CLOUDFLARE_R2', bucket: 'toeic-content', objectKey: 'ets-2018/test-01/questions/de.pdf', mimeType: 'application/pdf' },
      ])
      .returning({ id: assets.id, key: assets.objectKey })
    fullAudioId = rows.find((r) => r.key.endsWith('full.mp3'))!.id
    part2AudioId = rows.find((r) => r.key.endsWith('p2.mp3'))!.id
    pdfId = rows.find((r) => r.key.endsWith('de.pdf'))!.id

    const layout = [
      { partCode: 'PART_1', questionStart: 1, questionEnd: 2 },
      { partCode: 'PART_2', questionStart: 3, questionEnd: 4 },
      { partCode: 'PART_5', questionStart: 101, questionEnd: 102 },
    ]
    const created = await admin.post('/exams').send({ code: 'AUDIO-1', title: 'Audio exam', durationSeconds: 3600, parts: layout })
    expect(created.status).toBe(201)
    examId = created.body.id
    const questions = layout.flatMap((p) =>
      Array.from({ length: p.questionEnd - p.questionStart + 1 }, (_, i) => ({
        partCode: p.partCode,
        number: p.questionStart + i,
        prompt: '',
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key, correct: key === 'A' })),
      })),
    )
    expect((await put(admin, `/exams/${examId}/content`, { groups: [], questions })).status).toBe(200)
    expect((await admin.post(`/exams/${examId}/publish`)).status).toBe(200)
  })
  afterAll(async () => {
    await app.close()
  })

  async function startAttempt(body: object) {
    const res = await student.post(`/exams/${examId}/attempts`).send(body)
    expect(res.status).toBe(200)
    return res.body.id as string
  }

  it('only staff can attach audio, and only real audio files on Listening parts', async () => {
    expect((await put(student, `/exams/${examId}/audio`, { assetId: fullAudioId })).status).toBe(403)
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: pdfId })).status).toBe(400) // not audio
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400)
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: fullAudioId, partCode: 'PART_5' })).status).toBe(400) // Reading part
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: fullAudioId, partCode: 'PART_4' })).status).toBe(400) // not in this exam
    expect((await admin.get(`/exams/${examId}`)).body.hasAudio).toBe(false)
  })

  it('a full-length recording plays across every Listening part of a full test, via a signed URL', async () => {
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: fullAudioId })).status).toBe(200)
    expect((await admin.get(`/exams/${examId}`)).body.hasAudio).toBe(true)

    const attemptId = await startAttempt({ mode: 'FULL_TEST' })
    const player = await student.get(`/attempts/${attemptId}`)
    const tracks = audioOf(player.body)
    expect(tracks).toHaveLength(1)
    expect(tracks[0]).toMatchObject({ id: fullAudioId, label: 'Part 1–2', partCodes: ['PART_1', 'PART_2'] })
    expect(tracks[0].url).toMatch(/^https:\/\/r2\.test\/ets-2018\/test-01\/audio\/full\.mp3\?X-Amz-Expires=10800/)
    expect(new Date(tracks[0].expiresAt).getTime()).toBeGreaterThan(Date.now() + 2 * 3600_000)
    // Only the signed URL is exposed — never bucket/object key fields.
    expect(JSON.stringify(player.body)).not.toMatch(/objectKey|"bucket"/)

    // A refresh endpoint exists for long untimed sessions. Another student cannot see it; staff can, for review.
    expect(audioOf((await student.get(`/attempts/${attemptId}/audio`)).body)).toHaveLength(1)
    expect((await other.get(`/attempts/${attemptId}/audio`)).status).toBe(404)
    expect(audioOf((await admin.get(`/attempts/${attemptId}/audio`)).body)).toHaveLength(1)

    // Review after submitting keeps the recording for listening back.
    expect((await student.post(`/attempts/${attemptId}/submit`)).status).toBe(200)
    const review = await student.get(`/attempts/${attemptId}/review`)
    expect(audioOf(review.body)).toHaveLength(1)
  })

  it('a drill on one part gets no audio when only a full-length file exists', async () => {
    const attemptId = await startAttempt({ mode: 'PART_DRILL', partCodes: ['PART_2'] })
    expect(audioOf((await student.get(`/attempts/${attemptId}`)).body)).toEqual([])
  })

  it('a per-part recording enables drills and overrides the full-length file for that part', async () => {
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: part2AudioId, partCode: 'PART_2' })).status).toBe(200)

    const drill = await startAttempt({ mode: 'PART_DRILL', partCodes: ['PART_2'] })
    const drillTracks = audioOf((await student.get(`/attempts/${drill}`)).body)
    expect(drillTracks.map((t) => [t.id, t.partCodes])).toEqual([[part2AudioId, ['PART_2']]])

    const full = await startAttempt({ mode: 'FULL_TEST' })
    const fullTracks = audioOf((await student.get(`/attempts/${full}`)).body)
    expect(fullTracks.map((t) => [t.id, t.partCodes])).toEqual([
      [fullAudioId, ['PART_1']],
      [part2AudioId, ['PART_2']],
    ])
  })

  it('question photos and group figures: validated as image assets, exposed only as signed URLs', async () => {
    const [photo] = await db
      .insert(assets)
      .values({ provider: 'CLOUDFLARE_R2', bucket: 'toeic-content', objectKey: 'ets-2018/test-01/images/q-001.jpg', mimeType: 'image/jpeg' })
      .returning({ id: assets.id })
    const [figure] = await db
      .insert(assets)
      .values({ provider: 'CLOUDFLARE_R2', bucket: 'toeic-content', objectKey: 'ets-2018/test-01/images/fig-63.jpg', mimeType: 'image/jpeg' })
      .returning({ id: assets.id })

    const created = await admin.post('/exams').send({
      code: 'IMG-1',
      title: 'Picture exam',
      durationSeconds: 600,
      parts: [
        { partCode: 'PART_1', questionStart: 1, questionEnd: 1 },
        { partCode: 'PART_3', questionStart: 32, questionEnd: 32 },
      ],
    })
    expect(created.status).toBe(201)
    const id = created.body.id as string
    const opts = ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '', correct: key === 'B' }))
    const body = (p1Image: string, groupImage: string) => ({
      groups: [{ key: 'g32', partCode: 'PART_3', passages: [], imageAssetId: groupImage }],
      questions: [
        { partCode: 'PART_1', number: 1, prompt: '', imageAssetId: p1Image, options: opts },
        { partCode: 'PART_3', number: 32, prompt: 'Look at the graphic. Why?', groupKey: 'g32', options: opts },
      ],
    })

    expect((await put(admin, `/exams/${id}/content`, body(pdfId, figure.id))).status).toBe(400) // a PDF is not a picture
    expect((await put(admin, `/exams/${id}/content`, body(photo.id, '00000000-0000-4000-8000-000000000000'))).status).toBe(400)
    expect((await put(admin, `/exams/${id}/content`, body(photo.id, figure.id))).status).toBe(200)

    const staff = await admin.get(`/exams/${id}/content`)
    expect(staff.body.questions[0].imageAssetId).toBe(photo.id)
    expect(staff.body.groups[0].imageAssetId).toBe(figure.id)

    expect((await admin.post(`/exams/${id}/publish`)).status).toBe(200)
    const res = await student.post(`/exams/${id}/attempts`).send({ mode: 'PRACTICE' })
    const player = await student.get(`/attempts/${res.body.id}`)
    const q1 = player.body.questions.find((q: { number: number }) => q.number === 1)
    expect(q1.imageUrl).toMatch(/^https:\/\/r2\.test\/ets-2018\/test-01\/images\/q-001\.jpg\?/)
    expect(player.body.groups[0].imageUrl).toMatch(/fig-63\.jpg\?/)
    expect(JSON.stringify(player.body)).not.toMatch(/imageAssetId|objectKey/)
  })

  it('uploads a listening file onto the exam, and rejects reading exams and non-audio', async () => {
    uploaded.length = 0
    const clip = Buffer.from('ID3-fake-mp3')
    const postFile = (id: string, type: string, name = 'clip.mp3', partCode?: string) => {
      const q = new URLSearchParams({ filename: name })
      if (partCode) q.set('partCode', partCode)
      return admin.agent.post(`/api/v1/exams/${id}/audio/file?${q}`).set('x-toeic-client', 'web').set('content-type', type).send(clip)
    }

    const reading = await admin.post('/exams').send({
      code: 'AUDIO-RC',
      title: 'Reading only',
      durationSeconds: 600,
      parts: [{ partCode: 'PART_5', questionStart: 101, questionEnd: 101 }],
    })
    expect(reading.status).toBe(201)
    expect((await postFile(reading.body.id, 'audio/mpeg')).status).toBe(400)

    expect((await postFile(examId, 'application/pdf', 'notes.pdf')).status).toBe(400)
    expect(uploaded).toHaveLength(0)

    expect((await postFile(examId, 'audio/mpeg', 'full.mp3')).status).toBe(200)
    expect(uploaded[0]).toMatch(new RegExp(`^authored/${examId}/audio/full-\\d+\\.mp3$`))
    expect((await admin.get(`/exams/${examId}`)).body.hasAudio).toBe(true)

    expect((await postFile(examId, 'audio/wav', 'part2.wav', 'PART_2')).status).toBe(200)
    expect(uploaded.at(-1)).toMatch(/\/PART_2-\d+\.wav$/)

    const mixed = await admin.post('/exams/import-authored').send({
      code: 'MIX-1',
      title: 'Listening and reading',
      durationSeconds: 600,
      publish: false,
      parts: [
        { partCode: 'PART_2', questionStart: 1, questionEnd: 1 },
        { partCode: 'PART_5', questionStart: 2, questionEnd: 2 },
      ],
      groups: [],
      questions: ['PART_2', 'PART_5'].map((partCode, i) => ({
        partCode,
        number: i + 1,
        prompt: 'Q',
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key, correct: key === 'A' })),
      })),
    })
    expect(mixed.status).toBe(400)
  })

  it('returns no audio when storage is disabled, and after detaching', async () => {
    const attemptId = await startAttempt({ mode: 'FULL_TEST' })
    storage.enabled = false
    expect(audioOf((await student.get(`/attempts/${attemptId}`)).body)).toEqual([])
    storage.enabled = true

    expect((await put(admin, `/exams/${examId}/audio`, { assetId: null })).status).toBe(200)
    expect((await put(admin, `/exams/${examId}/audio`, { assetId: null, partCode: 'PART_2' })).status).toBe(200)
    expect(audioOf((await student.get(`/attempts/${attemptId}`)).body)).toEqual([])
    expect((await admin.get(`/exams/${examId}`)).body.hasAudio).toBe(false)
  })
})
