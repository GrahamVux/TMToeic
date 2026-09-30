/* Run pending migrations against DATABASE_URL (used by deploy pipeline): `npm run db:migrate` */
import { createDb } from './database.module'
import { loadConfig, loadDotEnv } from '../config/app-config'

async function main() {
  loadDotEnv()
  const config = loadConfig()
  if (!config.databaseUrl) {
    console.log('DATABASE_URL not set — migrating embedded PGlite at', config.pgliteDir)
  }
  const handle = await createDb({ ...config, autoMigrate: true })
  await handle.close()
  console.log('Migrations applied.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
