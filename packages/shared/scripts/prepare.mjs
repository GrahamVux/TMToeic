import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { syncDist } from './sync-dist.mjs'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

try {
  if (existsSync(new URL('../../../.git', import.meta.url))) {
    execSync('git config core.hooksPath .githooks', { cwd: repoRoot, stdio: 'ignore' })
  }
} catch {}

try {
  syncDist({ force: false })
} catch {}
