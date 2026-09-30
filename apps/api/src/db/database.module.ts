import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Pool } from 'pg'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import * as schema from './schema'
import { seedReferenceData } from './seed'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export const DB = Symbol('DB')
const DB_CLOSER = Symbol('DB_CLOSER')

export const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle')

const logger = new Logger('Database')

export type DbHandle = { db: Db; close: () => Promise<void>; kind: 'postgres' | 'pglite' }

/** Create a Drizzle instance: Supabase/Postgres when DATABASE_URL is set, otherwise embedded PGlite (real Postgres, in-process). */
export async function createDb(config: Pick<AppConfig, 'databaseUrl' | 'pgliteDir' | 'autoMigrate' | 'isProd'>): Promise<DbHandle> {
  let handle: DbHandle
  let migrateFn: () => Promise<void>

  if (config.databaseUrl) {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: config.isProd || /\.supabase\.(co|com)/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
    })
    const db = drizzlePg(pool, { schema })
    handle = { db: db as unknown as Db, close: () => pool.end(), kind: 'postgres' }
    migrateFn = () => migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER })
  } else {
    let client: PGlite
    if (config.pgliteDir === 'memory') {
      client = new PGlite()
    } else {
      const dir = resolve(config.pgliteDir)
      mkdirSync(dir, { recursive: true })
      client = new PGlite(dir)
    }
    const db = drizzlePglite(client, { schema })
    handle = { db: db as unknown as Db, close: () => client.close(), kind: 'pglite' }
    migrateFn = () => migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER })
  }

  if (config.autoMigrate) {
    logger.log(`Running migrations (${handle.kind})`)
    await migrateFn()
  }
  await seedReferenceData(handle.db)
  return handle
}

@Global()
@Module({
  providers: [
    {
      provide: DB_CLOSER,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => createDb(config),
    },
    { provide: DB, inject: [DB_CLOSER], useFactory: (h: DbHandle) => h.db },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_CLOSER) private readonly handle: DbHandle) {}

  async onApplicationShutdown() {
    await this.handle.close()
  }
}
