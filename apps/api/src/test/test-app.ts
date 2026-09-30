import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@toeic/shared'
import request from 'supertest'
import { AppModule } from '../app.module'
import { APP_CONFIG, loadConfig } from '../config/app-config'
import { configureApp } from '../setup'
import { StorageService } from '../storage/storage.service'

export const ADMIN = { username: 'admin', password: 'Bootstrap123' }

export async function createTestApp(
  overrides: Record<string, string> = {},
  extra: { storage?: Pick<StorageService, 'enabled' | 'signedGetUrl'> } = {},
): Promise<INestApplication> {
  process.env.LOGIN_RATE_LIMIT = '100000' // per-IP throttle is covered separately from account lockout
  const config = loadConfig({
    NODE_ENV: 'test',
    PGLITE_DIR: 'memory',
    AUTO_MIGRATE: 'true',
    BOOTSTRAP_ADMIN_USERNAME: ADMIN.username,
    BOOTSTRAP_ADMIN_PASSWORD: ADMIN.password,
    LOGIN_LOCKOUT_THRESHOLD: '3',
    ...overrides,
  } as NodeJS.ProcessEnv)

  const builder = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(APP_CONFIG).useValue(config)
  if (extra.storage) builder.overrideProvider(StorageService).useValue(extra.storage)
  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication()
  configureApp(app)
  await app.init()
  return app
}

/** supertest agent that keeps cookies and always sends the CSRF header like the web client does. */
export function client(app: INestApplication) {
  const agent = request.agent(app.getHttpServer())
  const wrap = (method: 'get' | 'post' | 'delete') => (url: string) => {
    const t = agent[method](`/api/v1${url}`)
    return method === 'get' ? t : t.set(CSRF_HEADER, CSRF_HEADER_VALUE)
  }
  return { get: wrap('get'), post: wrap('post'), delete: wrap('delete'), agent }
}

export type TestClient = ReturnType<typeof client>

export async function login(app: INestApplication, identifier: string, password: string) {
  const c = client(app)
  const res = await c.post('/auth/login').send({ identifier, password })
  return { c, res }
}