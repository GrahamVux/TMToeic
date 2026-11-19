import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppConfig } from '../config/app-config'
import { StorageService } from './storage.service'

function devConfig(): AppConfig {
  return {
    nodeEnv: 'development',
    isProd: false,
    jwtAccessSecret: 'dev-only-insecure-secret-change-me-0123456789abcdef',
    r2: { accountId: 'account', accessKeyId: 'key', secretAccessKey: 'secret', bucket: 'toeic' },
  } as AppConfig
}

describe('local development storage', () => {
  let dir: string
  const previous = process.env.LOCAL_OBJECT_DIR

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'toeic-objects-'))
    process.env.LOCAL_OBJECT_DIR = dir
  })
  afterAll(async () => {
    if (previous === undefined) delete process.env.LOCAL_OBJECT_DIR
    else process.env.LOCAL_OBJECT_DIR = previous
    await rm(dir, { recursive: true, force: true })
  })

  it('keeps the file on disk when Cloudflare refuses the upload', async () => {
    const storage = new StorageService(devConfig())
    ;(storage as unknown as { client: { send: (command: unknown) => Promise<void> } }).client = {
      send: () => Promise.reject(new Error('Unauthorized')),
    }
    const body = Buffer.from('jpeg-bytes')
    await storage.putObject('exams/scans/demo/q001.jpg', body, 'image/jpeg')

    const url = await storage.signedGetUrl('exams/scans/demo/q001.jpg', 60)
    const params = new URL(url, 'http://localhost')
    expect(params.pathname).toBe('/api/v1/local-objects')
    const file = await storage.openLocal(params.searchParams.get('key') ?? '', params.searchParams.get('exp') ?? '', params.searchParams.get('sig') ?? '')
    expect(file).toEqual({ data: body, mimeType: 'image/jpeg' })
  })

  it('still fails the upload outside development', async () => {
    const storage = new StorageService({ ...devConfig(), nodeEnv: 'production', isProd: true })
    ;(storage as unknown as { client: { send: () => Promise<void> } }).client = {
      send: () => Promise.reject(new Error('Unauthorized')),
    }
    await expect(storage.putObject('exams/scans/demo/q001.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow('Unauthorized')
  })
})
