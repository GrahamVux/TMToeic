import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sharedRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(sharedRoot, 'dist')
const pidFile = join(distDir, '.watch.pid')
const outputs = ['index.js', 'index.cjs', 'index.d.ts'].map((f) => join(distDir, f))

export function isWatcherAlive() {
  if (!existsSync(pidFile)) return false
  try {
    const pid = Number.parseInt(readFileSync(pidFile, 'utf8').trim(), 10)
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false
    process.kill(pid, 0)
    return true
  } catch {
    try {
      rmSync(pidFile, { force: true })
    } catch {}
    return false
  }
}

function newestMtimeMs(target) {
  if (!existsSync(target)) return 0
  const st = statSync(target)
  if (!st.isDirectory()) return st.mtimeMs
  let max = st.mtimeMs
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const m = newestMtimeMs(join(target, entry.name))
    if (m > max) max = m
  }
  return max
}

export function isDistFresh() {
  let oldestOut = Infinity
  for (const out of outputs) {
    if (!existsSync(out)) return false
    const m = statSync(out).mtimeMs
    if (m < oldestOut) oldestOut = m
  }
  const newestIn = Math.max(
    newestMtimeMs(join(sharedRoot, 'src')),
    newestMtimeMs(join(sharedRoot, 'package.json')),
    newestMtimeMs(join(sharedRoot, 'tsup.config.ts')),
  )
  return oldestOut >= newestIn
}

export function resolveTsupCli() {
  try {
    const req = createRequire(import.meta.url)
    const pkg = req.resolve('tsup/package.json')
    return join(dirname(pkg), 'dist', 'cli-default.js')
  } catch {
    return null
  }
}

export function syncDist({ force = false } = {}) {
  if (isWatcherAlive()) {
    if (outputs.every((f) => existsSync(f))) return 0
  }
  if (!force && isDistFresh()) return 0
  const tsupCli = resolveTsupCli()
  if (!tsupCli) return 0
  const res = spawnSync(process.execPath, [tsupCli], {
    cwd: sharedRoot,
    env: { ...process.env, TSUP_NO_CLEAN: '1' },
    stdio: 'inherit',
  })
  return res.status ?? 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = syncDist({ force: process.argv.includes('--force') })
  if (code !== 0) process.exit(code)
}
