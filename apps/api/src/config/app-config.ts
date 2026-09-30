import { Global, Module } from '@nestjs/common'
import { join, resolve, isAbsolute } from 'node:path'
import { z } from 'zod'

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789abcdef'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3001),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),

    DATABASE_URL: z.string().optional(),
    PGLITE_DIR: z.string().default('.data/pglite'),
    AUTO_MIGRATE: bool.optional(),

    JWT_ACCESS_SECRET: z.string().optional(),
    ACCESS_TTL_SECONDS: z.coerce.number().int().min(30).default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(14),
    COOKIE_SECURE: bool.optional(),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    BOOTSTRAP_ADMIN_USERNAME: z.string().default('admin'),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
    STUDENT_CODE_PREFIX: z.string().regex(/^[A-Z]{1,6}$/).default('TM'),
    /** Seed a small published demo exam. Defaults to on in development only. */
    SEED_DEMO_EXAM: bool.optional(),

    /** Cloudflare R2 (S3-compatible). All four are required together; leave empty to disable object storage. */
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),

    LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
    LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().int().min(1).default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 32) {
        ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'Required in production (>= 32 chars)' })
      }
      if (!env.DATABASE_URL) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required in production' })
      }
    }
    const r2 = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET].filter(Boolean).length
    if (r2 !== 0 && r2 !== 4) {
      ctx.addIssue({ code: 'custom', path: ['R2_BUCKET'], message: 'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must be set together' })
    }
    if (env.COOKIE_SAMESITE === 'none' && env.COOKIE_SECURE === false) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'SameSite=None requires COOKIE_SECURE=true' })
    }
  })

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production'
  isProd: boolean
  port: number
  corsOrigins: string[]
  databaseUrl?: string
  pgliteDir: string
  autoMigrate: boolean
  jwtAccessSecret: string
  accessTtlSeconds: number
  refreshTtlDays: number
  cookieSecure: boolean
  cookieSameSite: 'lax' | 'strict' | 'none'
  bootstrapAdminUsername: string
  bootstrapAdminPassword?: string
  studentCodePrefix: string
  seedDemoExam: boolean
  r2?: R2Config
  loginRateLimit: number
  loginLockoutThreshold: number
  loginLockoutMinutes: number
}

export const APP_CONFIG = Symbol('APP_CONFIG')

/** Load `.env` from the working directory if present (real env vars always win). Node >= 20.12. */
export function loadDotEnv(path = '.env') {
  try {
    process.loadEnvFile(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${msg}`)
  }
  const e = parsed.data
  const isProd = e.NODE_ENV === 'production'
  return {
    nodeEnv: e.NODE_ENV,
    isProd,
    port: e.PORT,
    corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    databaseUrl: e.DATABASE_URL || undefined,
    pgliteDir: e.PGLITE_DIR === 'memory' || isAbsolute(e.PGLITE_DIR) ? e.PGLITE_DIR : resolve(join(__dirname, '..', '..'), e.PGLITE_DIR),
    autoMigrate: e.AUTO_MIGRATE ?? !e.DATABASE_URL,
    jwtAccessSecret: e.JWT_ACCESS_SECRET || DEV_JWT_SECRET,
    accessTtlSeconds: e.ACCESS_TTL_SECONDS,
    refreshTtlDays: e.REFRESH_TTL_DAYS,
    cookieSecure: e.COOKIE_SECURE ?? isProd,
    cookieSameSite: e.COOKIE_SAMESITE,
    bootstrapAdminUsername: e.BOOTSTRAP_ADMIN_USERNAME.toLowerCase(),
    bootstrapAdminPassword: e.BOOTSTRAP_ADMIN_PASSWORD || (isProd ? undefined : 'ChangeMe123'),
    studentCodePrefix: e.STUDENT_CODE_PREFIX,
    seedDemoExam: e.SEED_DEMO_EXAM ?? e.NODE_ENV === 'development',
    r2:
      e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET
        ? {
            accountId: e.R2_ACCOUNT_ID,
            accessKeyId: e.R2_ACCESS_KEY_ID,
            secretAccessKey: e.R2_SECRET_ACCESS_KEY,
            bucket: e.R2_BUCKET,
          }
        : undefined,
    loginRateLimit: e.LOGIN_RATE_LIMIT,
    loginLockoutThreshold: e.LOGIN_LOCKOUT_THRESHOLD,
    loginLockoutMinutes: e.LOGIN_LOCKOUT_MINUTES,
  }
}

/** Global config module. Tests can override the provider with `overrideProvider(APP_CONFIG)`. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
